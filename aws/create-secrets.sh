#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION must be set}"

create_or_update_secret() {
  local name="$1"
  local value="$2"

  if aws secretsmanager describe-secret --secret-id "$name" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "Updating existing secret: $name"
    aws secretsmanager put-secret-value \
      --secret-id "$name" \
      --secret-string "$value" \
      --region "$AWS_REGION" >/dev/null
  else
    echo "Creating secret: $name"
    aws secretsmanager create-secret \
      --name "$name" \
      --secret-string "$value" \
      --region "$AWS_REGION" >/dev/null
  fi
}

echo "Generating JWT secret..."
JWT_SECRET_VALUE=$(openssl rand -base64 48)
create_or_update_secret "ridems/jwt-secret" "$JWT_SECRET_VALUE"

read -p "Enter MongoDB connection URL for user service (ridems/mongo-user): " MONGO_USER_URL
create_or_update_secret "ridems/mongo-user" "$MONGO_USER_URL"

read -p "Enter MongoDB connection URL for captain service (ridems/mongo-captain): " MONGO_CAPTAIN_URL
create_or_update_secret "ridems/mongo-captain" "$MONGO_CAPTAIN_URL"

read -p "Enter MongoDB connection URL for ride service (ridems/mongo-ride): " MONGO_RIDE_URL
create_or_update_secret "ridems/mongo-ride" "$MONGO_RIDE_URL"

read -p "Enter RabbitMQ connection URL (ridems/rabbit-url): " RABBIT_URL_VALUE
create_or_update_secret "ridems/rabbit-url" "$RABBIT_URL_VALUE"

echo ""
echo "All secrets created/updated in Secrets Manager (region: $AWS_REGION)."
