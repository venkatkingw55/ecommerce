#!/usr/bin/env bash
#
# teardown.sh - Remove all e-commerce resources from the cluster.
#
# Usage:
#   ./scripts/teardown.sh                    # delete app namespace only
#   ./scripts/teardown.sh --all              # also delete ingress controller, IngressClass, and PVCs
#   ./scripts/teardown.sh --keep-pvc         # keep PostgreSQL data (PVC)
#   ./scripts/teardown.sh -y                 # skip confirmation prompt
#
set -euo pipefail

NAMESPACE="${NAMESPACE:-ecommerce}"
DELETE_ALL=false
KEEP_PVC=false
AUTO_CONFIRM=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
header()  { echo -e "\n${BOLD}${BLUE}=== $* ===${NC}"; }

for arg in "$@"; do
  case "$arg" in
    --all)        DELETE_ALL=true ;;
    --keep-pvc)   KEEP_PVC=true ;;
    -y|--yes)     AUTO_CONFIRM=true ;;
    -h|--help)    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

# ---- Confirm ---------------------------------------------------------------
header "Confirm"
echo -e "${YELLOW}This will delete the '${NAMESPACE}' namespace and all its resources:${NC}"
echo "  - 5 Deployments (frontend, user-service, product-service, cart-service, payment-service)"
echo "  - 1 StatefulSet (postgres)"
echo "  - 6 Services (frontend, user-service, product-service, cart-service, payment-service, postgres)"
echo "  - 2 Ingress resources (ecommerce-api-ingress, ecommerce-frontend-ingress)"
echo "  - 2 Secrets (postgres-secret, app-secret)"
echo "  - 2 ConfigMaps (postgres-config, postgres-init-scripts)"
if [[ "${KEEP_PVC}" == "false" ]]; then
  echo -e "  - ${RED}PVC postgres-data-postgres-0 (PostgreSQL data will be LOST)${NC}"
fi
if [[ "${DELETE_ALL}" == "true" ]]; then
  echo -e "  - ${RED}Nginx Ingress Controller (namespace, ClusterRoles, IngressClass, webhooks)${NC}"
  echo -e "  - ${RED}GCP Load Balancer (auto-deleted when ingress-nginx service is removed)${NC}"
fi

if [[ "${AUTO_CONFIRM}" != "true" ]]; then
  read -r -p "Continue? [y/N] " confirm
  if [[ "${confirm}" != "y" && "${confirm}" != "Y" && "${confirm}" != "yes" && "${confirm}" != "YES" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ---- Namespace (all app resources) -----------------------------------------
header "Deleting namespace '${NAMESPACE}'"
if kubectl get ns "${NAMESPACE}" >/dev/null 2>&1; then
  if [[ "${KEEP_PVC}" == "true" ]]; then
    log "Preserving PVCs (postgres data)..."
    kubectl delete deployment,statefulset,service,ingress,configmap,secret \
      --all -n "${NAMESPACE}" --ignore-not-found
  else
    kubectl delete namespace "${NAMESPACE}" --ignore-not-found
  fi
  success "Namespace '${NAMESPACE}' cleanup complete"
else
  warn "Namespace '${NAMESPACE}' does not exist"
fi

# ---- Ingress controller (optional) -----------------------------------------
if [[ "${DELETE_ALL}" == "true" ]]; then
  header "Deleting Nginx Ingress Controller"

  log "Deleting ingress-nginx namespace (controller, admission webhooks, LB service)..."
  kubectl delete namespace ingress-nginx --ignore-not-found --timeout=60s

  log "Deleting cluster-scoped resources..."
  kubectl delete clusterrole ingress-nginx ingress-nginx-admission --ignore-not-found
  kubectl delete clusterrolebinding ingress-nginx ingress-nginx-admission --ignore-not-found
  kubectl delete ingressclass nginx --ignore-not-found
  kubectl delete validatingwebhookconfiguration ingress-nginx-admission --ignore-not-found

  success "Ingress controller and all associated resources removed"
fi

# ---- Summary ---------------------------------------------------------------
header "Done"
log "Verify cleanup:"
echo "  kubectl get ns"
echo "  kubectl get pv"
echo "  kubectl get ingressclass"
if [[ "${DELETE_ALL}" == "true" ]]; then
  echo ""
  log "Check for leftover GCP resources:"
  echo "  gcloud compute forwarding-rules list --project=ia-securearmor"
  echo "  gcloud compute target-pools list --project=ia-securearmor"
  echo "  gcloud compute disks list --project=ia-securearmor --filter='name~pvc'"
fi
