#!/usr/bin/env bash
# Restore drill: restore latest backup into a scratch DB and compare critical row counts.
# Fail loud on mismatch. Does NOT touch the primary database data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "restore-drill: DATABASE_URL is required" >&2
  exit 1
fi

DUMP="${1:-backups/latest.sql}"
if [[ ! -f "$DUMP" ]]; then
  echo "restore-drill: dump not found ($DUMP) — run ./scripts/backup.sh first" >&2
  exit 1
fi

SRC_URL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.search=''; console.log(u.toString())")"
# scratch DB on same host/user
SCRATCH_URL="$(node -e "
const u=new URL(process.env.DATABASE_URL);
u.search='';
u.pathname='/' + (process.env.RESTORE_SCRATCH_DB || 'ridaa_restore_drill');
console.log(u.toString());
")"
SCRATCH_DB="$(node -e "console.log((process.env.RESTORE_SCRATCH_DB||'ridaa_restore_drill'))")"
ADMIN_URL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.search=''; u.pathname='/postgres'; console.log(u.toString())")"

echo "restore-drill: source counts"
SRC_COUNTS="$(psql "$SRC_URL" -At -F',' -c "
SELECT 'Beneficiary,'||count(*) FROM \"Beneficiary\"
UNION ALL SELECT 'Attendance,'||count(*) FROM \"Attendance\"
UNION ALL SELECT 'DispenseOrder,'||count(*) FROM \"DispenseOrder\"
UNION ALL SELECT 'ExhibitionInvite,'||count(*) FROM \"ExhibitionInvite\"
UNION ALL SELECT 'InventoryItem,'||count(*) FROM \"InventoryItem\"
UNION ALL SELECT 'AuditLog,'||count(*) FROM \"AuditLog\"
ORDER BY 1;
")"
printf '%s\n' "$SRC_COUNTS"

echo "restore-drill: recreating scratch db ${SCRATCH_DB}"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${SCRATCH_DB}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${SCRATCH_DB}\";"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${SCRATCH_DB}\";"

echo "restore-drill: restoring dump into scratch"
psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -f "$DUMP" >/tmp/restore-drill.log 2>&1 || {
  echo "restore-drill: restore FAILED — raw log:" >&2
  cat /tmp/restore-drill.log >&2
  exit 1
}

echo "restore-drill: scratch counts"
DST_COUNTS="$(psql "$SCRATCH_URL" -At -F',' -c "
SELECT 'Beneficiary,'||count(*) FROM \"Beneficiary\"
UNION ALL SELECT 'Attendance,'||count(*) FROM \"Attendance\"
UNION ALL SELECT 'DispenseOrder,'||count(*) FROM \"DispenseOrder\"
UNION ALL SELECT 'ExhibitionInvite,'||count(*) FROM \"ExhibitionInvite\"
UNION ALL SELECT 'InventoryItem,'||count(*) FROM \"InventoryItem\"
UNION ALL SELECT 'AuditLog,'||count(*) FROM \"AuditLog\"
ORDER BY 1;
")"
printf '%s\n' "$DST_COUNTS"

if [[ "$SRC_COUNTS" != "$DST_COUNTS" ]]; then
  echo "restore-drill: COUNT MISMATCH" >&2
  echo "BEFORE:" >&2
  printf '%s\n' "$SRC_COUNTS" >&2
  echo "AFTER:" >&2
  printf '%s\n' "$DST_COUNTS" >&2
  exit 1
fi

echo "restore-drill: PASS — row counts match"
echo "BEFORE_COUNTS<<EOF"
printf '%s\n' "$SRC_COUNTS"
echo "EOF"
echo "AFTER_COUNTS<<EOF"
printf '%s\n' "$DST_COUNTS"
echo "EOF"
