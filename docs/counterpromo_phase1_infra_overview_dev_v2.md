
# Counter Promo — Phase 1 Infrastructure Reference (DEV, eu-west-2)

This document captures the **current, working DEV infrastructure** for Counter Promo (Phase 1) in AWS so it can be reused, audited, or recreated later.

> **AWS Account:** 437064342167  
> **Region:** eu-west-2 (London)  
> **Primary DEV URL:** https://dev.counterpromo.com  
> **Env strategy:** DEV-only running now; PROD to be added later with parallel resources and `/counterpromo/prod/...` config namespaces.

---

## 1) High-level Architecture

### Runtime request flow
**Browser → ALB (HTTPS 443) → ECS Web** (default path `/*`)  
**Browser → ALB (HTTPS 443) → ECS API** for `/api/*` and `/webhooks/*`

### Background processing flow
**ECS Worker → SQS Jobs Queue → job execution → DB + S3**

### Data + config
- **RDS PostgreSQL** (private)
- **S3 buckets** for uploads/assets/exports (private, versioned)
- **SSM Parameter Store** for non-secret config
- **Secrets Manager** for secrets (DB + Stripe keys)

---

## 2) Naming Conventions

### Environment prefixes
- `counterpromo-dev-*` for AWS resources in DEV
- `counterpromo-devlocal-*` for AWS-backed “local” dev utilities (e.g., devlocal SQS)

### Parameter/secret namespaces
- SSM: `/counterpromo/{env}/...`
- Secrets: `counterpromo/{env}/...`

---

## 3) Networking

### VPC
- **VPC:** `counterpromo-dev-vpc`
- **CIDR:** 10.10.0.0/16
- **Subnets:**
  - Public subnets: ALB
  - Private subnets: ECS tasks + RDS
- **RDS:** private only (no public accessibility)

### VPC Endpoints
DEV uses VPC endpoints so private-subnet tasks can reach AWS services without public internet egress.

Common endpoints present:
- S3 (Gateway)
- DynamoDB (Gateway, if created)
- ECR API (Interface)
- ECR Docker (Interface)
- CloudWatch Logs (Interface) **com.amazonaws.eu-west-2.logs**
- SQS (Interface)
- Secrets Manager (Interface)
- SSM (Interface)

**Operational note (encountered & fixed):**  
Interface endpoints are protected by a security group. When adding a new ECS service with a new SG (e.g., WEB), you must allow that SG inbound to the endpoint SG on **443**, otherwise Fargate tasks can fail during log initialization.

---

## 4) Load Balancing + DNS

### Application Load Balancer (ALB)
- **ALB:** `counterpromo-dev-alb`
- **Type:** internet-facing
- **Listeners:**
  - HTTP :80 → redirect to HTTPS :443
  - HTTPS :443 → routing rules

### HTTPS / ACM
- ACM certificate is attached to the HTTPS listener for `dev.counterpromo.com`.

### Listener routing rules (HTTPS :443)
Order matters:
1. **Path `/api/*` →** `counterpromo-dev-tg-api`
2. **Path `/webhooks/*` →** `counterpromo-dev-tg-api`
3. **Default `/*` →** `counterpromo-dev-tg-web`

### Route 53 (with Hover registrar)
- Domain registrar: Hover
- DNS is configured so `dev.counterpromo.com` resolves to the ALB (typically via Route 53 hosted zone + Alias record, and Hover NS delegation to Route 53).

---

## 5) ECS (Fargate)

### ECS Cluster
- **Cluster:** `counterpromo-dev-cluster`
- Compute: Fargate

### Services (3)
1. **WEB**
   - **Service:** `counterpromo-dev-svc-web`
   - **Task definition:** `counterpromo-dev-td-web`
   - **Container port:** 80
   - **Target group:** `counterpromo-dev-tg-web` (HTTP:80, health check `/`)
   - **Image (placeholder):** `public.ecr.aws/nginx/nginx:latest`
   - **Purpose:** Serves the web UI (Next.js later; nginx placeholder currently)

2. **API**
   - **Service:** existing API service in the cluster (created earlier)
   - **Task definition:** `counterpromo-dev-td-api`
   - **Container port:** 3000
   - **Target group:** `counterpromo-dev-tg-api` (HTTP:3000, health check `/health`)
   - **Purpose:** Backend API + Stripe webhooks

3. **WORKER**
   - **Service:** `counterpromo-dev-svc-worker`
   - **Task definition:** `counterpromo-dev-td-worker`
   - **Purpose:** Polls SQS and processes jobs

### CloudWatch Logs
All containers log to CloudWatch logs with the shared log group:
- **Log group:** `/ecs/counterpromo-dev`
- Stream prefixes:
  - `web`
  - `api`
  - `worker`

---

## 6) Target Groups

### WEB
- **Target group:** `counterpromo-dev-tg-web`
- **Target type:** IP
- **Protocol/Port:** HTTP:80
- **Health check:** GET `/`

### API
- **Target group:** `counterpromo-dev-tg-api`
- **Target type:** IP
- **Protocol/Port:** HTTP:3000
- **Health check:** GET `/health`

---

## 7) Database (RDS PostgreSQL)

### RDS instance
- **Identifier:** `counterpromo-dev-postgres`
- **Engine:** PostgreSQL
- **Port:** 5432
- **Network:** private subnets, SG-restricted
- **Access:** via ECS tasks in private subnets (and optional temporary dbtest EC2/SSM session)

### Schema objects created (Phase 1)
- `billing_plans`
- `accounts`
- `usage_monthly`
- `promos`
- Supporting indexes + triggers/functions for updated timestamps

### Connection values (stored in SSM/Secrets)
- Host/port/name in SSM
- Username/password in Secrets Manager

---

## 8) Storage (S3)

### Buckets (private)
- `counterpromo-dev-uploads-437064342167`
- `counterpromo-dev-assets-437064342167`
- `counterpromo-dev-exports-437064342167`

### Common settings
- Block Public Access: enabled
- Versioning: enabled
- Lifecycle rules: configured where available (some console screens may not expose all options, e.g. multipart abort)

---

## 9) Messaging (SQS)

### DEV queues
- `counterpromo-dev-jobs`
- `counterpromo-dev-jobs-dlq`

### “Local dev” queues (AWS-backed)
These exist so a developer can test SQS flows without competing with the always-on DEV worker:
- `counterpromo-devlocal-jobs`
- `counterpromo-devlocal-jobs-dlq`

**Recommended usage:**
- Local laptop / dev scripts → devlocal queue
- ECS worker in DEV → dev queue
- Future PROD worker → prod queue

---

## 10) Configuration & Secrets

### SSM Parameter Store
Namespace pattern:
```
/counterpromo/{env}/...
```

Typical DEV parameters:
- `/counterpromo/dev/db/host`
- `/counterpromo/dev/db/port`
- `/counterpromo/dev/db/name`
- `/counterpromo/dev/sqs/jobs_queue_url`
- `/counterpromo/dev/s3/uploads_bucket`
- `/counterpromo/dev/s3/assets_bucket`
- `/counterpromo/dev/s3/exports_bucket`
- `/counterpromo/dev/stripe/price_*`

DEVLOCAL example:
- `/counterpromo/devlocal/sqs/jobs_queue_url`

### Secrets Manager
Common secrets:
- `counterpromo/dev/db/postgres` (username/password)
- `counterpromo/dev/stripe/secret_key`
- `counterpromo/dev/stripe/webhook_secret`

---

## 11) Security Groups (DEV)

> Names may vary slightly depending on how they were created; the intent/traffic model is the key.

### ALB SG
Inbound:
- 80 from 0.0.0.0/0
- 443 from 0.0.0.0/0

Outbound:
- 3000 to API task SG
- 80 to WEB task SG

### ECS API SG
Inbound:
- 3000 from ALB SG

Outbound:
- 5432 to RDS SG
- 443 to VPC interface endpoints (ECR/SQS/SSM/Secrets/Logs)

### ECS WORKER SG
Inbound:
- none

Outbound:
- 443 to VPC interface endpoints (SQS/SSM/Secrets/Logs)
- 5432 to RDS SG

### ECS WEB SG (`counterpromo-dev-sg-ecs-web`)
Inbound:
- 80 from ALB SG

Outbound:
- 443 to VPC interface endpoints (Logs at minimum)

### RDS SG
Inbound:
- 5432 from ECS API SG
- 5432 from ECS WORKER SG
- temporary 5432 from dbtest SG (only if used)

### VPC Endpoint SG (Interface Endpoints)
Inbound:
- 443 from ECS API SG
- 443 from ECS WORKER SG
- 443 from ECS WEB SG  ✅ (added to fix web task init)

Outbound:
- allow all (typical)

---

## 12) IAM Roles & Permissions (Key Points)

### ECS roles
- **Task role:** `counterpromo-dev-ecs-task-app`
  - App-level permissions (SQS/S3/SSM/etc as required)

- **Execution role:** `counterpromo-dev-ecs-exec-default`
  - Pull images
  - Write CloudWatch logs
  - Read Secrets Manager / SSM at task startup (secrets injection)

**Previously encountered issue:**  
Execution role required `secretsmanager:GetSecretValue` for the DB secret ARN so the API task could start with injected secrets.

### GitHub Actions deployment (OIDC)
- Role: `counterpromo-dev-github-deployer`
- Trust policy restricted to the GitHub repo + branch (main) for workflows.

---

## 13) Stripe (Test Mode)

- Price ID used:
  - `price_1SvgC3GTMcpBWf0yIiwTxLYq`
- Webhook endpoint (DEV):
  - `https://dev.counterpromo.com/webhooks/stripe`
- Plan mapping strategy:
  - Store price/product-to-plan mapping in SSM under a stable namespace (e.g., `/counterpromo/dev/billing/price_map/...`)

---

## 14) Observability / Alarms (Minimal)

Current approach is minimal alarms during early dev. Full alerting is intended to be finalized once Phase 1 application is stable.

Recommended minimum (later):
- ALB 5XX
- TargetGroup UnHealthyHostCount > 0
- ECS desired vs running mismatch
- RDS FreeStorageSpace low
- SQS DLQ depth > 0

---

## 15) Promotion Strategy (DEV → PROD)

Current state: **DEV only running**.

Recommended promotion approach:
1. Develop locally
2. Deploy to DEV via GitHub Actions
3. Validate in DEV / QA
4. Promote to PROD via a dedicated workflow + manual approval
5. PROD uses:
   - separate resources (DB/queues/buckets at minimum)
   - separate `/counterpromo/prod/...` namespace
   - separate GitHub role `counterpromo-prod-github-deployer`

---

## 16) Current Status

✅ ECS services running: **web, api, worker**  
✅ ALB routing: `/* → web`, `/api/* → api`, `/webhooks/* → api`  
✅ CloudWatch logging functional (after allowing WEB SG to reach interface endpoints on 443)  
✅ SQS dev + devlocal separation established  
✅ RDS schema initialized and reachable from private network

Next intended step: replace WEB placeholder image with the actual Next.js build pushed to ECR and deployed via CI/CD.
