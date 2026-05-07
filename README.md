# E-Commerce Multi-Tier Architecture on GKE

A complete e-commerce application demonstrating multi-tier architecture with microservices deployed on Google Kubernetes Engine (GKE).

## Architecture

```
                                    ┌─────────────────┐
                                    │   Client/User   │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Nginx Ingress  │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
     ┌────────▼────────┐          ┌─────────▼─────────┐          ┌────────▼────────┐
     │    Frontend     │          │  /api/users       │          │  /api/products  │
     │   (React App)   │          │  User Service     │          │ Product Service │
     └─────────────────┘          └─────────┬─────────┘          └────────┬────────┘
                                            │                             │
              ┌─────────────────────────────┼─────────────────────────────┤
              │                             │                             │
     ┌────────▼────────┐          ┌────────▼────────┐            ┌───────▼───────┐
     │  /api/cart      │          │ /api/payments   │            │   PostgreSQL  │
     │  Cart Service   │          │ Payment Service │            │  StatefulSet  │
     └────────┬────────┘          └────────┬────────┘            └───────────────┘
              │                            │
              └────────────────────────────┘
```

## Components

| Component | Technology | Port | Description |
|-----------|------------|------|-------------|
| Frontend | React + Vite + Tailwind | 80 | Modern SPA with product browsing, cart, checkout |
| User Service | FastAPI | 8001 | User registration, authentication, JWT tokens |
| Product Service | FastAPI | 8002 | Product catalog management |
| Cart Service | FastAPI | 8003 | Shopping cart operations |
| Payment Service | FastAPI | 8004 | Order processing and payments |
| PostgreSQL | PostgreSQL 15 | 5432 | StatefulSet with persistent storage |

## Prerequisites

- GKE cluster with Nginx Ingress Controller installed
- `kubectl` configured to access your cluster
- Docker for building images
- Container registry (GCR, Artifact Registry, or Docker Hub)

## Directory Structure

```
k8s/
├── frontend/              # React frontend application
├── services/
│   ├── user-service/      # User/Auth microservice
│   ├── product-service/   # Product catalog microservice
│   ├── cart-service/      # Cart management microservice
│   └── payment-service/   # Payment/Order microservice
├── k8s/
│   ├── namespace.yaml
│   ├── app-secret.yaml
│   ├── ingress.yaml
│   ├── postgres/          # PostgreSQL StatefulSet manifests
│   ├── frontend/          # Frontend deployment manifests
│   ├── user-service/      # User service deployment manifests
│   ├── product-service/   # Product service deployment manifests
│   ├── cart-service/      # Cart service deployment manifests
│   └── payment-service/   # Payment service deployment manifests
└── README.md
```

## Deployment Instructions

### 1. Set Your Container Registry

All 5 images (frontend + 4 microservices) live under a **single registry path**. The Deployment files use a placeholder `IMAGE_REGISTRY` which you'll substitute with your actual registry.

#### Option A: Google Container Registry (gcr.io) — simplest

No repo creation needed. Your project ID is the namespace.

```bash
export PROJECT_ID="ia-securearmor"
export REGISTRY="gcr.io/${PROJECT_ID}"

# Authenticate Docker to push to GCR
gcloud auth configure-docker

# Enable the Container Registry API (one-time)
gcloud services enable containerregistry.googleapis.com --project=${PROJECT_ID}
```

Final image paths:
- `gcr.io/ia-securearmor/frontend:latest`
- `gcr.io/ia-securearmor/user-service:latest`
- `gcr.io/ia-securearmor/product-service:latest`
- `gcr.io/ia-securearmor/cart-service:latest`
- `gcr.io/ia-securearmor/payment-service:latest`

#### Option B: Artifact Registry (recommended by Google)

Create **one** repository that holds all 5 images.

```bash
export PROJECT_ID="ia-securearmor"
export REGION="us-central1"
export REPO_NAME="ecommerce"
export REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

# Enable the Artifact Registry API (one-time)
gcloud services enable artifactregistry.googleapis.com --project=${PROJECT_ID}

# Create a single Docker repo for all images (one-time)
gcloud artifacts repositories create ${REPO_NAME} \
  --repository-format=docker \
  --location=${REGION} \
  --description="Ecommerce app images" \
  --project=${PROJECT_ID}

# Authenticate Docker to push to this region
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

Final image paths:
- `us-central1-docker.pkg.dev/ia-securearmor/ecommerce/frontend:latest`
- `us-central1-docker.pkg.dev/ia-securearmor/ecommerce/user-service:latest`
- `us-central1-docker.pkg.dev/ia-securearmor/ecommerce/product-service:latest`
- `us-central1-docker.pkg.dev/ia-securearmor/ecommerce/cart-service:latest`
- `us-central1-docker.pkg.dev/ia-securearmor/ecommerce/payment-service:latest`

#### Substitute the placeholder in all manifests

After setting `$REGISTRY`, replace `IMAGE_REGISTRY` everywhere:

```bash
# macOS (BSD sed):
find k8s/ -name "*.yaml" -exec sed -i '' "s|IMAGE_REGISTRY|${REGISTRY}|g" {} \;

# Linux (GNU sed):
find k8s/ -name "*.yaml" -exec sed -i "s|IMAGE_REGISTRY|${REGISTRY}|g" {} \;
```

Verify the substitution:
```bash
grep -r "image:" k8s/
```

### 2. Build and Push Docker Images

> **IMPORTANT — Cross-platform builds for Mac users**
>
> GKE nodes run **`linux/amd64`** (x86_64). If you build on a Mac (especially Apple Silicon M1/M2/M3) without specifying a platform, your images will be `arm64` and pods will crash on GKE with:
> ```
> exec /usr/local/bin/uvicorn: exec format error
> ```
> Always use `docker buildx build --platform linux/amd64 --push` when building from a Mac.

Check your Mac's architecture:
```bash
uname -m
# arm64  -> Apple Silicon (M1/M2/M3) - MUST use --platform linux/amd64
# x86_64 -> Intel Mac - --platform linux/amd64 still recommended
```

#### Recommended: `docker buildx` (cross-platform, builds + pushes in one step)

```bash
# One-time: create a multi-arch builder
docker buildx create --name multiarch --use --bootstrap 2>/dev/null || docker buildx use multiarch

# Build and push frontend (linux/amd64)
docker buildx build \
  --platform linux/amd64 \
  -t ${REGISTRY}/frontend:latest \
  --push \
  ./frontend

# Build and push all 4 microservices
for service in user-service product-service cart-service payment-service; do
  docker buildx build \
    --platform linux/amd64 \
    -t ${REGISTRY}/${service}:latest \
    --push \
    ./services/${service}
done
```

> **Why `--push` and not `docker push` after?**
> `buildx` cross-compiles directly to a registry layer; the resulting image is not loaded into your local Docker daemon (because your arm64 Mac can't natively run amd64 images). The `--push` flag uploads it straight to Artifact Registry.

#### Alternative: Standard `docker build` (only works correctly on `linux/amd64` hosts)

Use this only if you're building on a Linux x86_64 machine or an Intel Mac and don't want buildx:

```bash
docker build --platform linux/amd64 -t ${REGISTRY}/frontend:latest ./frontend
docker push ${REGISTRY}/frontend:latest

for service in user-service product-service cart-service payment-service; do
  docker build --platform linux/amd64 -t ${REGISTRY}/${service}:latest ./services/${service}
  docker push ${REGISTRY}/${service}:latest
done
```

#### Verify image architecture (critical step)

After pushing, confirm each image is `linux/amd64`:

```bash
for img in frontend user-service product-service cart-service payment-service; do
  echo "=== ${img} ==="
  docker manifest inspect ${REGISTRY}/${img}:latest | grep -E '"architecture"|"os"' | head -2
done
```

Expected output for each image:
```
"architecture": "amd64",
"os": "linux",
```

If you see `"architecture": "arm64"`, the image will fail on GKE — rebuild with `--platform linux/amd64`.

#### Verify images are in the registry

```bash
# Artifact Registry
gcloud artifacts docker images list ${REGISTRY}

# GCR
gcloud container images list --repository=${REGISTRY}
```

You should see all 5 images: `frontend`, `user-service`, `product-service`, `cart-service`, `payment-service`.

#### Diagnosing architecture mismatch on a running cluster

If pods are crashing with `CrashLoopBackOff`, check the logs:

```bash
kubectl logs <pod-name> -n ecommerce
```

Architecture mismatch errors look like:
- `exec /usr/local/bin/uvicorn: exec format error`
- `standard_init_linux.go: ... exec format error`
- `nginx: ... exec format error`

Fix: rebuild with `--platform linux/amd64 --push`, then restart the deployment:
```bash
kubectl rollout restart deployment <service-name> -n ecommerce
```

### 3. Install Nginx Ingress Controller (if not installed)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

### 4. Deploy to Kubernetes

Deploy in the following order:

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy secrets
kubectl apply -f k8s/postgres/secret.yaml
kubectl apply -f k8s/app-secret.yaml

# Deploy PostgreSQL
kubectl apply -f k8s/postgres/configmap.yaml
kubectl apply -f k8s/postgres/service.yaml
kubectl apply -f k8s/postgres/statefulset.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod/postgres-0 -n ecommerce --timeout=120s

# Deploy microservices
kubectl apply -f k8s/user-service/
kubectl apply -f k8s/product-service/
kubectl apply -f k8s/cart-service/
kubectl apply -f k8s/payment-service/

# Deploy frontend
kubectl apply -f k8s/frontend/

# Deploy Ingress
kubectl apply -f k8s/ingress.yaml
```

### 5. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n ecommerce

# Check services
kubectl get svc -n ecommerce

# Check ingress
kubectl get ingress -n ecommerce
```

### 6. Access the Application

Get the external IP of the Ingress:

```bash
kubectl get ingress ecommerce-ingress -n ecommerce
```

Access the application at `http://<EXTERNAL-IP>`

## API Endpoints

### User Service (`/api/users`)
- `POST /register` - Register new user
- `POST /login` - User login (returns JWT)
- `GET /profile` - Get current user profile

### Product Service (`/api/products`)
- `GET /` - List products (supports `?category=`, `?search=`)
- `GET /{id}` - Get product details
- `POST /` - Create product
- `GET /categories` - List categories

### Cart Service (`/api/cart`)
- `GET /` - Get current cart
- `POST /items` - Add item to cart
- `PUT /items/{id}` - Update item quantity
- `DELETE /items/{id}` - Remove item
- `DELETE /` - Clear cart

### Payment Service (`/api/payments`)
- `POST /checkout` - Process checkout
- `GET /orders` - List user orders
- `GET /orders/{id}` - Get order details

## Configuration

### Update Secrets (Production)

Before deploying to production, update these secrets:

1. `k8s/postgres/secret.yaml` - Change `POSTGRES_PASSWORD`
2. `k8s/app-secret.yaml` - Change `JWT_SECRET`

### Resource Limits

Adjust resource requests/limits in deployment files based on your workload:

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### Storage Class

The PostgreSQL StatefulSet uses `standard-rw` storage class. Update if your GKE cluster uses a different storage class:

```yaml
storageClassName: standard-rw  # Change as needed
```

## Development

### Run Locally

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Backend services:
```bash
cd services/user-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## Cleanup

Remove all resources:

```bash
kubectl delete namespace ecommerce
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n ecommerce
kubectl logs <pod-name> -n ecommerce
```

### `exec format error` (architecture mismatch)

**Symptom:** Pods in `CrashLoopBackOff`, logs show:
```
exec /usr/local/bin/uvicorn: exec format error
```

**Cause:** Image was built for `arm64` (Mac) instead of `linux/amd64` (GKE).

**Fix:** Rebuild with cross-platform support:
```bash
docker buildx create --name multiarch --use --bootstrap 2>/dev/null || docker buildx use multiarch

docker buildx build --platform linux/amd64 -t ${REGISTRY}/frontend:latest --push ./frontend
for s in user-service product-service cart-service payment-service; do
  docker buildx build --platform linux/amd64 -t ${REGISTRY}/${s}:latest --push ./services/${s}
done

# Force pods to pull the new image
kubectl rollout restart deployment -n ecommerce
```

Verify each image is `amd64`:
```bash
docker manifest inspect ${REGISTRY}/frontend:latest | grep -E '"architecture"|"os"'
```

### Database connection issues
```bash
kubectl exec -it postgres-0 -n ecommerce -- psql -U postgres -c "\l"
```

### Ingress not working
```bash
kubectl describe ingress ecommerce-ingress -n ecommerce
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Image pull errors (`ErrImagePull` / `ImagePullBackOff`)

**Symptom:**
```
Failed to pull image "us-central1-docker.pkg.dev/ia-securearmor/ecommerce/frontend:latest":
... permission denied
```

**Fix:** Grant the GKE node service account read access to Artifact Registry:
```bash
PROJECT_NUMBER=$(gcloud projects describe ia-securearmor --format='value(projectNumber)')

gcloud projects add-iam-policy-binding ia-securearmor \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"
```
