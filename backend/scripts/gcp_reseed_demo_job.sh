#!/usr/bin/env bash
# One-off Cloud Run Job: reset_and_seed_demo on Cloud SQL (via dev_reseed_demo.py).
#
# Prerequisites:
#   - gcloud CLI, logged in, project cnad-safety-response
#   - roles: run.admin, cloudsql.client, secretmanager.secretAccessor (on your user or CI SA)
#
# Usage (from repo root):
#   ./backend/scripts/gcp_reseed_demo_job.sh
#   ./backend/scripts/gcp_reseed_demo_job.sh --execute-only   # skip deploy, only run existing job
#
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-cnad-safety-response}"
REGION="${GCP_REGION:-asia-east1}"
JOB_NAME="${GCP_RESEED_JOB_NAME:-demo-reseed}"
SERVICE_ACCOUNT="${GCP_RUN_SA:-safety-app-sa@${PROJECT_ID}.iam.gserviceaccount.com}"
CLOUDSQL_INSTANCE="${GCP_CLOUDSQL_INSTANCE:-${PROJECT_ID}:${REGION}:employee-safety-db}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "$BACKEND_DIR/Dockerfile" ]] || [[ ! -f "$BACKEND_DIR/scripts/dev_reseed_demo.py" ]]; then
  echo "ERROR: backend source not found at: $BACKEND_DIR" >&2
  echo "Run this script from the repo (e.g. ./backend/scripts/gcp_reseed_demo_job.sh)." >&2
  exit 1
fi

EXECUTE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --execute-only) EXECUTE_ONLY=true ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

echo "Project:     $PROJECT_ID"
echo "Region:      $REGION"
echo "Job:         $JOB_NAME"
echo "Cloud SQL:   $CLOUDSQL_INSTANCE"
echo "Source:      $BACKEND_DIR"
echo ""

gcloud config set project "$PROJECT_ID" >/dev/null

if [[ "$EXECUTE_ONLY" != true ]]; then
  echo "==> Deploying Cloud Run Job (builds image from backend/, includes scripts/)..."
  gcloud run jobs deploy "$JOB_NAME" \
    --source "$BACKEND_DIR" \
    --region "$REGION" \
    --service-account="$SERVICE_ACCOUNT" \
    --set-cloudsql-instances="$CLOUDSQL_INSTANCE" \
    --network=default \
    --subnet=default \
    --vpc-egress=private-ranges-only \
    --set-env-vars="ENV=development,USE_GCP=false,REDIS_ENABLED=false,PYTHONPATH=/app" \
    --set-secrets="DATABASE_URL=employee-safety-database-url:latest,JWT_SECRET=employee-safety-jwt-secret:latest" \
    --command=python \
    --args=scripts/dev_reseed_demo.py \
    --max-retries=0 \
    --task-timeout=600s \
    --memory=512Mi \
    --cpu=1 \
    --quiet
  echo ""
fi

echo "==> Executing job (reset_and_seed_demo — TRUNCATES business data)..."
gcloud run jobs execute "$JOB_NAME" --region "$REGION" --wait

echo ""
echo "Done. Check logs if needed:"
echo "  gcloud run jobs executions list --job=$JOB_NAME --region=$REGION --limit=1"
echo ""
echo "Verify API:"
echo "  curl -sS https://safety-response-api-zc5lsyet2q-de.a.run.app/health"
echo "Login: admin@test.com / password"
