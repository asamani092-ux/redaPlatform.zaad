#!/usr/bin/env bash
# Apply pending Prisma migrations — fail loud (non-zero) on any error.
# Note: `prisma migrate status` exits 1 when migrations are pending; that is expected
# before deploy and must not abort the pipeline. Real failures still exit non-zero.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "apply-pending: DATABASE_URL is required" >&2
  exit 1
fi

echo "apply-pending: listing migration status"
set +e
STATUS_OUT="$(npx prisma migrate status 2>&1)"
STATUS_RC=$?
set -e
printf '%s\n' "$STATUS_OUT"

if [[ "$STATUS_RC" -ne 0 ]]; then
  if printf '%s\n' "$STATUS_OUT" | grep -qE 'have not yet been applied|Following migrations? have not yet been applied|not yet been applied'; then
    echo "apply-pending: pending migrations detected — proceeding to deploy"
  elif printf '%s\n' "$STATUS_OUT" | grep -qiE 'Database schema is up to date|No pending migrations'; then
    echo "apply-pending: already up to date"
    exit 0
  else
    echo "apply-pending: migrate status failed (exit $STATUS_RC)" >&2
    exit "$STATUS_RC"
  fi
fi

echo "apply-pending: deploying pending migrations"
npx prisma migrate deploy

echo "apply-pending: verifying status after deploy"
npx prisma migrate status

echo "apply-pending: done"
