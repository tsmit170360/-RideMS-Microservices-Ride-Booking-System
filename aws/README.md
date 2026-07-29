# RideMS — AWS Deployment (ECS Fargate)

Deploys the four backend services (gateway, user, captain, ride) to ECS Fargate,
with images pushed to private ECR repositories and configuration pulled from
Secrets Manager. The frontend is also pushed to ECR as a static nginx image
(intended for ECS/Fargate behind a load balancer, or any static host of your choice).

## Prerequisites

- AWS CLI v2, authenticated (`aws sts get-caller-identity` works)
- Docker with buildx (for `--platform linux/amd64` builds)
- `jq`, `openssl`, `git` available on PATH
- An existing VPC/subnets/security groups and an ECS cluster named `ridems`
  (`aws ecs create-cluster --cluster-name ridems`)
- `AWS_REGION` exported in your shell (e.g. `export AWS_REGION=ap-south-1`)

All scripts in this folder are idempotent where practical — safe to re-run.

## Deployment steps, in order

1. **Set your region**
   ```bash
   export AWS_REGION=ap-south-1
   ```

2. **Create ECR repositories**
   ```bash
   ./aws/setup-ecr.sh
   ```
   Creates `ridems/gateway`, `ridems/user`, `ridems/captain`, `ridems/ride`,
   `ridems/frontend` with image scanning, immutable tags, and a 10-image
   lifecycle policy. Prints the registry URL.

3. **Create secrets in Secrets Manager**
   ```bash
   ./aws/create-secrets.sh
   ```
   Auto-generates `ridems/jwt-secret`. Prompts you for MongoDB URLs
   (`ridems/mongo-user`, `ridems/mongo-captain`, `ridems/mongo-ride`) and the
   RabbitMQ URL (`ridems/rabbit-url`).

4. **Set up IAM roles and log groups**
   ```bash
   ./aws/setup-iam.sh
   ```
   Creates `ecsTaskExecutionRole` (ECS trust policy + `AmazonECSTaskExecutionRolePolicy`
   + inline `secretsmanager:GetSecretValue` on `ridems/*`), an empty `ridems-task-role`,
   and CloudWatch log groups `/ecs/ridems/{gateway,user,captain,ride}` with 14-day retention.

5. **Build and push images**
   ```bash
   export VITE_API_URL=https://your-gateway-domain.example.com
   ./aws/build-push.sh            # tags with current git SHA
   # or: ./aws/build-push.sh v1.2.3
   ```

6. **Edit the task definition templates**
   Open `aws/ecs-task-definitions/*.json` and replace:
   - `USER_SERVICE_URL` / `CAPTAIN_SERVICE_URL` / `RIDE_SERVICE_URL` (gateway) and
     `BASE_URL` (ride) with your actual internal service-discovery / Cloud Map
     endpoints, or an internal ALB/NLB DNS name
   - `CORS_ORIGIN` (gateway) with your real frontend domain

   `ACCOUNT_ID_PLACEHOLDER`, `REGION_PLACEHOLDER`, and `IMAGE_TAG_PLACEHOLDER`
   are filled in automatically by `deploy-ecs.sh` — leave those as-is.

7. **Create the ECS services (one-time, per service)**
   Register the task definition once manually and create each service pointing
   at your subnets/security groups, e.g.:
   ```bash
   aws ecs create-service \
     --cluster ridems \
     --service-name ridems-user \
     --task-definition ridems-user \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxx],securityGroups=[sg-xxxx],assignPublicIp=ENABLED}"
   ```
   Repeat for `ridems-captain`, `ridems-ride`, `ridems-gateway`. Only `gateway`
   needs a public-facing load balancer/target group in front of it.

8. **Deploy (subsequent releases)**
   ```bash
   export ECS_CLUSTER=ridems
   ./aws/deploy-ecs.sh            # tags with current git SHA
   # or: ./aws/deploy-ecs.sh v1.2.3
   ```
   Registers updated task definitions, forces a new deployment on each service,
   and waits for `services-stable` before printing final status.

9. **CI/CD (optional)**
   See `.github/workflows/deploy.yml` — pushes to `main` build, push, and deploy
   automatically via OIDC (no long-lived AWS keys). Requires `AWS_ROLE_ARN` and
   `VITE_API_URL` configured as repository secrets.

## Script reference

| Script | Purpose |
|---|---|
| `setup-ecr.sh` | Create ECR repos + lifecycle policy |
| `create-secrets.sh` | Create/rotate Secrets Manager entries |
| `setup-iam.sh` | Create execution/task IAM roles + log groups |
| `build-push.sh [tag]` | Build and push all images to ECR |
| `deploy-ecs.sh [tag]` | Register task defs + update ECS services |
