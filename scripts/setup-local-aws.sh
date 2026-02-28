#!/usr/bin/env bash
# setup-local-aws.sh — configure AWS resources for local dev
# Run AFTER: aws sso login --profile AdministratorAccess-437064342167
set -euo pipefail

PROFILE="AdministratorAccess-437064342167"
REGION="eu-west-2"
UPLOADS_BUCKET="counterpromo-dev-uploads-437064342167"
ASSETS_BUCKET="counterpromo-dev-assets-437064342167"
QUEUE_NAME="counterpromo-devlocal-jobs"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CounterPromo Local AWS Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Check AWS identity ──────────────────────────────────────────────────────
echo ""
echo "▶ Checking AWS identity..."
ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --query Account --output text 2>&1) || {
  echo "  ✗ AWS credentials invalid or expired."
  echo "    Run: aws sso login --profile $PROFILE"
  exit 1
}
echo "  ✓ Authenticated as account $ACCOUNT"

# ── Check S3 buckets ────────────────────────────────────────────────────────
echo ""
echo "▶ Checking S3 buckets..."
for BUCKET in "$UPLOADS_BUCKET" "$ASSETS_BUCKET"; do
  if aws s3api head-bucket --bucket "$BUCKET" --profile "$PROFILE" 2>/dev/null; then
    echo "  ✓ $BUCKET exists"
  else
    echo "  Creating $BUCKET..."
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" \
      --profile "$PROFILE"
    echo "  ✓ $BUCKET created"
  fi
done

# ── Configure CORS on uploads bucket (needed for browser → S3 presigned PUT) ──
echo ""
echo "▶ Configuring CORS on uploads bucket..."
aws s3api put-bucket-cors \
  --bucket "$UPLOADS_BUCKET" \
  --profile "$PROFILE" \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT", "HEAD"],
        "AllowedOrigins": [
          "http://localhost:3000",
          "https://dev.counterpromo.com"
        ],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
      }
    ]
  }'
echo "  ✓ CORS configured on $UPLOADS_BUCKET"

# ── Check SQS queue ─────────────────────────────────────────────────────────
echo ""
echo "▶ Checking SQS queue..."
QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name "$QUEUE_NAME" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query QueueUrl --output text 2>/dev/null) || QUEUE_URL=""

if [ -n "$QUEUE_URL" ]; then
  echo "  ✓ Queue exists: $QUEUE_URL"
else
  echo "  Creating queue $QUEUE_NAME..."
  QUEUE_URL=$(aws sqs create-queue \
    --queue-name "$QUEUE_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query QueueUrl --output text)
  echo "  ✓ Queue created: $QUEUE_URL"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All checks passed. Ready for local dev."
echo ""
echo "  Start everything with:"
echo "    npm run dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
