#!/usr/bin/env bash
# أداة مساعدة اختيارية (نسخ قبل ترحيل). إقلاع الإنتاج الرسمي = Dockerfile CMD:
#   ./scripts/apply-pending.sh && node server.js
# لا بذرة هنا أبداً.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "boot: DATABASE_URL is required" >&2
  exit 1
fi
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
mkdir -p "$BACKUP_DIR" || true
if [[ "${BACKUP_BEFORE_MIGRATE:-0}" == "1" ]] && command -v pg_dump >/dev/null 2>&1; then
  STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  OUT="${BACKUP_DIR}/ridaa-pre-migrate-${STAMP}.sql"
  PGURL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.search=''; console.log(u.toString())")"
  pg_dump --no-owner --no-privileges --format=plain "$PGURL" > "$OUT" || true
fi
./scripts/apply-pending.sh
exec node server.js
