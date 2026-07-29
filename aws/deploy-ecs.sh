#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION must be set}"
: "${ECS_CLUSTER:?ECS_CLUSTER must be set}"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
TAG="${1:-$(git rev-parse --short HEAD)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES=(gateway user captain ride)

for service in "${SERVICES[@]}"; do
  SRC_FILE="$SCRIPT_DIR/ecs-task-definitions/${service}.json"
  OUT_FILE="$(mktemp)"

  sed \
    -e "s/ACCOUNT_ID_PLACEHOLDER/${AWS_ACCOUNT_ID}/g" \
    -e "s/REGION_PLACEHOLDER/${AWS_REGION}/g" \
    -e "s/IMAGE_TAG_PLACEHOLDER/${TAG}/g" \
    "$SRC_FILE" > "$OUT_FILE"

  echo "Registering task definition for ridems-${service} (tag: ${TAG})..."
  aws ecs register-task-definition \
    --cli-input-json "file://${OUT_FILE}" \
    --region "$AWS_REGION" >/dev/null

  rm -f "$OUT_FILE"

  echo "Updating ECS service ridems-${service} on cluster ${ECS_CLUSTER}..."
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "ridems-${service}" \
    --task-definition "ridems-${service}" \
    --force-new-deployment \
    --region "$AWS_REGION" >/dev/null
done

echo "Waiting for services to reach a stable state..."
aws ecs wait services-stable \
  --cluster "$ECS_CLUSTER" \
  --services "${SERVICES[@]/#/ridems-}" \
  --region "$AWS_REGION"

echo ""
echo "Deployment complete. Status:"
aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "${SERVICES[@]/#/ridems-}" \
  --region "$AWS_REGION" \
  --query "services[].{name:serviceName,status:status,running:runningCount,desired:desiredCount,taskDef:taskDefinition}" \
  --output table
