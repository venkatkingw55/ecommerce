#!/usr/bin/env bash
#
# deploy.sh - Deploy the entire e-commerce stack to GKE in one shot.
#
# Usage:
#   ./scripts/deploy.sh
#   ./scripts/deploy.sh --skip-ingress-controller
#   NAMESPACE=ecommerce ./scripts/deploy.sh
#
set -euo pipefail

# ---- Configuration ---------------------------------------------------------
NAMESPACE="${NAMESPACE:-ecommerce}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
K8S_DIR="${ROOT_DIR}/k8s"
SKIP_INGRESS_CONTROLLER=false
INGRESS_CONTROLLER_VERSION="controller-v1.10.0"
POSTGRES_TIMEOUT="180s"
DEPLOYMENT_TIMEOUT="180s"

# ---- Colors ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()      { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
success()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn()     { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()    { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header()   { echo -e "\n${BOLD}${BLUE}=== $* ===${NC}"; }

# ---- Argument parsing ------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --skip-ingress-controller) SKIP_INGRESS_CONTROLLER=true ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      error "Unknown argument: $arg"
      exit 1 ;;
  esac
done

# ---- Pre-flight checks -----------------------------------------------------
header "Pre-flight checks"

if ! command -v kubectl >/dev/null 2>&1; then
  error "kubectl is not installed or not on PATH"
  exit 1
fi
success "kubectl found: $(kubectl version --client -o yaml 2>/dev/null | grep gitVersion | head -1 | awk '{print $2}')"

if ! kubectl cluster-info >/dev/null 2>&1; then
  error "Cannot connect to cluster. Check your kubeconfig with: kubectl config current-context"
  exit 1
fi
success "Connected to cluster: $(kubectl config current-context)"

if [[ ! -d "${K8S_DIR}" ]]; then
  error "K8s manifests directory not found: ${K8S_DIR}"
  exit 1
fi
success "K8s manifests directory: ${K8S_DIR}"

if grep -r "IMAGE_REGISTRY" "${K8S_DIR}" >/dev/null 2>&1; then
  error "Found unsubstituted IMAGE_REGISTRY placeholder in manifests."
  error "Run: find k8s/ -name '*.yaml' -exec sed -i '' 's|IMAGE_REGISTRY|<your-registry>|g' {} \\;"
  exit 1
fi
success "All image references substituted"

# ---- Namespace -------------------------------------------------------------
header "Step 1/8: Namespace"
kubectl apply -f "${K8S_DIR}/namespace.yaml"
success "Namespace '${NAMESPACE}' ready"

# ---- Secrets ---------------------------------------------------------------
header "Step 2/8: Secrets"
kubectl apply -f "${K8S_DIR}/postgres/secret.yaml"
kubectl apply -f "${K8S_DIR}/app-secret.yaml"
success "Secrets applied"

# ---- PostgreSQL ------------------------------------------------------------
header "Step 3/8: PostgreSQL StatefulSet"
kubectl apply -f "${K8S_DIR}/postgres/configmap.yaml"
kubectl apply -f "${K8S_DIR}/postgres/service.yaml"
kubectl apply -f "${K8S_DIR}/postgres/statefulset.yaml"
log "Waiting for postgres-0 to be ready (timeout: ${POSTGRES_TIMEOUT})..."
if kubectl wait --for=condition=ready pod/postgres-0 \
  -n "${NAMESPACE}" --timeout="${POSTGRES_TIMEOUT}"; then
  success "PostgreSQL is ready"
else
  error "PostgreSQL failed to become ready within ${POSTGRES_TIMEOUT}"
  kubectl describe pod postgres-0 -n "${NAMESPACE}" || true
  kubectl logs postgres-0 -n "${NAMESPACE}" --tail=50 || true
  exit 1
fi

# ---- Microservices ---------------------------------------------------------
header "Step 4/8: Backend microservices"
SERVICES=(user-service product-service cart-service payment-service)
for svc in "${SERVICES[@]}"; do
  log "Applying ${svc}..."
  kubectl apply -f "${K8S_DIR}/${svc}/"
done
success "All 4 microservices applied"

# ---- Frontend --------------------------------------------------------------
header "Step 5/8: Frontend"
kubectl apply -f "${K8S_DIR}/frontend/"
success "Frontend applied"

# ---- Ingress controller (optional) -----------------------------------------
header "Step 6/8: Nginx Ingress Controller"
if [[ "${SKIP_INGRESS_CONTROLLER}" == "true" ]]; then
  warn "Skipping ingress controller install (--skip-ingress-controller)"
elif kubectl get ns ingress-nginx >/dev/null 2>&1; then
  success "Ingress controller already installed"
else
  log "Installing Nginx Ingress Controller (${INGRESS_CONTROLLER_VERSION})..."
  kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_CONTROLLER_VERSION}/deploy/static/provider/cloud/deploy.yaml"
  log "Waiting for ingress controller to be ready..."
  kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=300s || warn "Ingress controller not ready yet, continuing..."
  success "Ingress controller installed"
fi

# ---- Ingress resources -----------------------------------------------------
header "Step 7/8: Ingress resources"
kubectl apply -f "${K8S_DIR}/ingress.yaml"
success "Ingress resources applied (API + Frontend)"

# ---- Wait for deployments to be ready --------------------------------------
header "Step 8/8: Waiting for all deployments to be ready"
ALL_DEPLOYMENTS=(frontend user-service product-service cart-service payment-service)
for dep in "${ALL_DEPLOYMENTS[@]}"; do
  log "Waiting for deployment/${dep}..."
  if kubectl rollout status "deployment/${dep}" -n "${NAMESPACE}" --timeout="${DEPLOYMENT_TIMEOUT}"; then
    success "${dep} rolled out"
  else
    error "${dep} failed to roll out within ${DEPLOYMENT_TIMEOUT}"
    kubectl describe deployment "${dep}" -n "${NAMESPACE}" || true
    kubectl get pods -n "${NAMESPACE}" -l "app=${dep}" || true
    exit 1
  fi
done

# ---- Summary ---------------------------------------------------------------
header "Deployment complete"

echo
log "Pods in '${NAMESPACE}':"
kubectl get pods -n "${NAMESPACE}" -o wide

echo
log "Services in '${NAMESPACE}':"
kubectl get svc -n "${NAMESPACE}"

echo
log "Ingress in '${NAMESPACE}':"
kubectl get ingress -n "${NAMESPACE}"

echo
log "Fetching external IP from ingress controller..."
EXTERNAL_IP="$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo '')"

if [[ -n "${EXTERNAL_IP}" ]]; then
  echo
  echo -e "${GREEN}${BOLD}=== Application is live ===${NC}"
  echo -e "  Frontend:           ${BOLD}http://${EXTERNAL_IP}/${NC}"
  echo -e "  User API health:    http://${EXTERNAL_IP}/api/users/health"
  echo -e "  Product API health: http://${EXTERNAL_IP}/api/products/health"
  echo -e "  Cart API health:    http://${EXTERNAL_IP}/api/cart/health"
  echo -e "  Payment API health: http://${EXTERNAL_IP}/api/payments/health"
else
  warn "External IP not yet assigned. Check with:"
  echo "  kubectl get svc -n ingress-nginx ingress-nginx-controller --watch"
fi

echo
success "Done!"
