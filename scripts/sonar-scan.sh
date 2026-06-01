#!/usr/bin/env bash
# Run tests with coverage, then SonarQube scan (requires Docker: sonarqube + sonarsource/sonar-scanner-cli).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PY="${ROOT}/backend/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "Create backend venv first: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-test.txt"
  exit 1
fi

echo "==> Backend: pytest + coverage (from project root so paths match SonarQube)"
"$PY" -m pytest backend/tests \
  --cov=backend/app \
  --cov-config=backend/.coveragerc.sonar \
  --cov-report=xml:backend/coverage.xml \
  --junitxml=backend/junit.xml
"$PY" scripts/fix-coverage-for-sonar.py backend/coverage.xml
"$PY" scripts/fix-junit-for-sonar.py backend/junit.xml

echo "==> SonarQube scan (coverage: backend only)"
docker run --rm \
  --platform linux/amd64 \
  -e SONAR_HOST_URL="${SONAR_HOST_URL:-http://host.docker.internal:9000}" \
  -e SONAR_TOKEN="${SONAR_TOKEN:?Set SONAR_TOKEN (SonarQube > My Account > Security)}" \
  -v "${ROOT}:/usr/src" \
  -w /usr/src \
  sonarsource/sonar-scanner-cli

echo "Done. Open ${SONAR_HOST_URL:-http://localhost:9000}/dashboard?id=cnad-safety-response"
