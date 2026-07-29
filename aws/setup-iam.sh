#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION must be set}"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}'

SECRETS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:ridems/*"
    }
  ]
}
EOF
)

echo "Creating ecsTaskExecutionRole..."
if aws iam get-role --role-name ecsTaskExecutionRole >/dev/null 2>&1; then
  echo "ecsTaskExecutionRole already exists, skipping creation"
else
  aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi

echo "Attaching AmazonECSTaskExecutionRolePolicy..."
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

echo "Attaching inline secrets policy for ridems/* to ecsTaskExecutionRole..."
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name ridems-secrets-access \
  --policy-document "$SECRETS_POLICY"

echo "Creating ridems-task-role (empty, application-level permissions)..."
if aws iam get-role --role-name ridems-task-role >/dev/null 2>&1; then
  echo "ridems-task-role already exists, skipping creation"
else
  aws iam create-role \
    --role-name ridems-task-role \
    --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi

echo "Creating CloudWatch log groups..."
SERVICES=(gateway user captain ride)
for service in "${SERVICES[@]}"; do
  LOG_GROUP="/ecs/ridems/${service}"
  if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$AWS_REGION" \
      --query "logGroups[?logGroupName=='${LOG_GROUP}']" --output text | grep -q "$LOG_GROUP"; then
    echo "Log group $LOG_GROUP already exists, skipping creation"
  else
    aws logs create-log-group --log-group-name "$LOG_GROUP" --region "$AWS_REGION"
  fi
  aws logs put-retention-policy \
    --log-group-name "$LOG_GROUP" \
    --retention-in-days 14 \
    --region "$AWS_REGION"
done

echo ""
echo "IAM roles and log groups ready."
echo "ecsTaskExecutionRole ARN: arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole"
echo "ridems-task-role ARN: arn:aws:iam::${AWS_ACCOUNT_ID}:role/ridems-task-role"
