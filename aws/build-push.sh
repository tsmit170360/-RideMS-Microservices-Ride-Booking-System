#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION must be set}"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
TAG="${1:-$(git rev-parse --short HEAD)}"

echo "Logging in to ECR registry $REGISTRY"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"

BACKEND_SERVICES=(gateway user captain ride)

for service in "${BACKEND_SERVICES[@]}"; do
  echo "Building and pushing ridems/$service:$TAG"
  docker build --platform linux/amd64 -t "$REGISTRY/ridems/$service:$TAG" "./$service"
  docker push "$REGISTRY/ridems/$service:$TAG"
done

echo "Building and pushing ridems/frontend:$TAG"
docker build --platform linux/amd64 \
  --build-arg VITE_API_URL="${VITE_API_URL:?must be set}" \
  -t "$REGISTRY/ridems/frontend:$TAG" \
  "./frontend"
docker push "$REGISTRY/ridems/frontend:$TAG"

echo ""
echo "Pushed tag: $TAG"
