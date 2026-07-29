#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION must be set}"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_ACCOUNT_ID

REPOS=(ridems/gateway ridems/user ridems/captain ridems/ride ridems/frontend)

LIFECYCLE_POLICY='{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    }
  ]
}'

for repo in "${REPOS[@]}"; do
  if aws ecr describe-repositories --repository-names "$repo" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "Repository $repo already exists, skipping creation"
  else
    echo "Creating ECR repository: $repo"
    aws ecr create-repository \
      --repository-name "$repo" \
      --region "$AWS_REGION" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability IMMUTABLE
  fi

  echo "Applying lifecycle policy to $repo"
  aws ecr put-lifecycle-policy \
    --repository-name "$repo" \
    --region "$AWS_REGION" \
    --lifecycle-policy-text "$LIFECYCLE_POLICY" >/dev/null
done

REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo ""
echo "ECR registry URL: $REGISTRY"
