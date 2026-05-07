#!/usr/bin/env bash
#
# status.sh - Quickly check the health of the e-commerce stack.
#
set -euo pipefail

NAMESPACE="${NAMESPACE:-ecommerce}"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

header() { echo -e "\n${BOLD}${BLUE}=== $* ===${NC}"; }

header "Pods"
kubectl get pods -n "${NAMESPACE}" -o wide 2>/dev/null || echo "Namespace not found"

header "Deployments"
kubectl get deployments -n "${NAMESPACE}" 2>/dev/null || true

header "StatefulSets"
kubectl get statefulsets -n "${NAMESPACE}" 2>/dev/null || true

header "Services"
kubectl get svc -n "${NAMESPACE}" 2>/dev/null || true

header "Ingress (API + Frontend)"
kubectl get ingress -n "${NAMESPACE}" 2>/dev/null || true

header "Ingress Controller"
kubectl get pods -n ingress-nginx -o wide 2>/dev/null || echo "Ingress controller not installed"

header "Persistent Volumes"
kubectl get pvc -n "${NAMESPACE}" 2>/dev/null || true

header "External Access"
EXTERNAL_IP="$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo '')"
if [[ -n "${EXTERNAL_IP}" ]]; then
  echo -e "${GREEN}Application URL:${NC}       http://${EXTERNAL_IP}/"
  echo -e "${GREEN}User API:${NC}              http://${EXTERNAL_IP}/api/users/health"
  echo -e "${GREEN}Product API:${NC}           http://${EXTERNAL_IP}/api/products/health"
  echo -e "${GREEN}Cart API:${NC}              http://${EXTERNAL_IP}/api/cart/health"
  echo -e "${GREEN}Payment API:${NC}           http://${EXTERNAL_IP}/api/payments/health"
else
  echo -e "${YELLOW}External IP not yet assigned${NC}"
fi

header "Recent events (last 10)"
kubectl get events -n "${NAMESPACE}" \
  --sort-by='.lastTimestamp' 2>/dev/null | tail -10 || true
