# Counter Promo --- Phase 1 Infrastructure Overview (DEV)

## 1. Environment Summary

**AWS Account:** 437064342167\
**Region:** eu-west-2 (London)\
**Environment:** DEV\
**Domain:** dev.counterpromo.com\
**Primary Stack Type:** Containerized (ECS Fargate)\
**Deployment Model:** GitHub Actions → AWS (OIDC)

------------------------------------------------------------------------

## 2. High-Level Architecture

**Flow:**

User → Route53 → ALB (HTTPS) → ECS API →\
• RDS (PostgreSQL)\
• S3 (uploads/assets/exports)\
• SQS (jobs queue + DLQ)\
• SSM + Secrets Manager

Worker (ECS) → Polls SQS → Processes jobs → Writes to S3 / DB

Stripe (Test Mode) → Webhook → API (`/webhooks/stripe`)

------------------------------------------------------------------------

## 3. Networking

### VPC

-   Name: `counterpromo-dev-vpc`
-   CIDR: 10.10.0.0/16
-   Public subnets (ALB)
-   Private subnets (ECS + RDS)
-   No public RDS access

### Load Balancer

-   Name: `counterpromo-dev-alb`
-   HTTP :80 → Redirect to HTTPS :443
-   HTTPS :443 → Forward to target group
-   ACM certificate for `dev.counterpromo.com`

------------------------------------------------------------------------

## 4. ECS Services

### API Service

-   Cluster: `counterpromo-dev-cluster`
-   Task Definition: `counterpromo-dev-td-api`
-   Port: 3000
-   Logs: CloudWatch `/ecs/counterpromo-dev`

### Worker Service

-   Task Definition: `counterpromo-dev-td-worker`
-   Polls SQS
-   Logs: CloudWatch

------------------------------------------------------------------------

## 5. Database

### RDS PostgreSQL

-   Identifier: `counterpromo-dev-postgres`
-   Port: 5432
-   Private only
-   Credentials stored in Secrets Manager

Tables created: - billing_plans - accounts - usage_monthly - promos

------------------------------------------------------------------------

## 6. S3 Buckets

-   `counterpromo-dev-uploads-437064342167`
-   `counterpromo-dev-assets-437064342167`
-   `counterpromo-dev-exports-437064342167`

Features: - Block public access enabled - Versioning enabled - Lifecycle
rules configured

------------------------------------------------------------------------

## 7. SQS

Queues: - `counterpromo-dev-jobs` - `counterpromo-dev-jobs-dlq` -
`counterpromo-devlocal-jobs` - `counterpromo-devlocal-jobs-dlq`

Configuration stored in SSM.

------------------------------------------------------------------------

## 8. Configuration Management

### SSM Parameter Store

Namespace pattern:

    /counterpromo/{env}/...

Examples: - `/counterpromo/dev/sqs/jobs_queue_url` -
`/counterpromo/dev/stripe/price_starter_monthly` -
`/counterpromo/devlocal/sqs/jobs_queue_url`

### Secrets Manager

Examples: - `/counterpromo/dev/db/postgres` -
`/counterpromo/dev/stripe/secret_key` -
`/counterpromo/dev/stripe/webhook_secret`

Execution role has read access.

------------------------------------------------------------------------

## 9. CI/CD

### GitHub → AWS OIDC Role

Role: `counterpromo-dev-github-deployer`

Trust restricted to:

    repo:js-cox-creator/counterpromo:ref:refs/heads/main

Deployment Flow: Local Dev → Push → Deploy to DEV → QA → (future) manual
promote to PROD

------------------------------------------------------------------------

## 10. Stripe Integration (Test Mode)

Price ID: - Starter: `price_1SvgC3GTMcpBWf0yIiwTxLYq`

Webhook endpoint:

    https://dev.counterpromo.com/webhooks/stripe

Plan mapping via SSM:

    /counterpromo/dev/billing/price_map/{priceId}

------------------------------------------------------------------------

## 11. Security Groups (DEV)

### ALB SG

Inbound: - 80 from 0.0.0.0/0 - 443 from 0.0.0.0/0

Outbound: - 3000 to ECS API SG

### ECS API SG

Inbound: - 3000 from ALB SG

Outbound: - 5432 to RDS SG - 443 to AWS services

### ECS Worker SG

Inbound: - None

Outbound: - 443 to AWS services - 5432 to RDS SG

### RDS SG

Inbound: - 5432 from ECS API SG - 5432 from ECS Worker SG - Temporary
5432 from dbtest SG

------------------------------------------------------------------------

## 12. Monitoring (Minimal for Phase 1)

-   SNS topic for alerts
-   RDS FreeStorageSpace alarm
-   ECS availability alarm (to be finalized post Phase 1)

------------------------------------------------------------------------

## 13. Promotion Strategy

Current: DEV only\
Future: - Separate PROD stack - Manual promotion step in CI/CD -
Separate `/counterpromo/prod/...` parameters - Separate queues, buckets,
and DB

------------------------------------------------------------------------

## 14. Phase 1 Status

Infrastructure is production-patterned but operating as DEV-only. Ready
for application implementation and Stripe billing logic.
