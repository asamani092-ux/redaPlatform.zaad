#!/usr/bin/env bash
# Full logical backup of the application database — fail loud.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "backup: DATABASE_URL is required" >&2
  exit 1
fi

mkdir -p backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="backups/ridaa-${STAMP}.sql"

# pg_dump rejects ?schema= — strip query
PGURL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.search=''; console.log(u.toString())")"

echo "backup: dumping to ${OUT}"
pg_dump --no-owner --no-privileges --format=plain "$PGURL" > "$OUT"
test -s "$OUT" || { echo "backup: empty dump" >&2; exit 1; }

# stable pointer for restore-drill
ln -sfn "$(basename "$OUT")" backups/latest.sql
echo "backup: done bytes=$(wc -c < "$OUT")"
echo "BACKUP_FILE=${OUT}"
