#!/usr/bin/env sh
# إقلاع الإنتاج: ترحيل تراكمي ثم الخادم — بلا بذرة.
# عند الفشل ننتظر قليلاً لتظهر السجلات في Coolify/docker logs.
set -eu

hold_and_exit() {
  code="${1:-1}"
  echo "entrypoint: FATAL exit=${code} — holding 120s for log capture" >&2
  sleep 120
  exit "${code}"
}

echo "entrypoint: boot begin PORT=${PORT:-3100}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "entrypoint: DATABASE_URL missing at runtime" >&2
  hold_and_exit 1
fi

echo "entrypoint: DATABASE_URL present (chars=${#DATABASE_URL})"
node -e "try{const u=new URL(process.env.DATABASE_URL); console.log('entrypoint: db='+u.protocol+'//'+u.hostname+':'+ (u.port||'5432') + u.pathname)}catch(e){console.error('entrypoint: DATABASE_URL unparseable'); process.exit(2)}" \
  || hold_and_exit 2

# مسارات الرفع/الشواهد — mkdir لا يكفي وحده؛ يلزم volume دائم على /data من Coolify
UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"
mkdir -p "${UPLOADS_DIR}/evidence" "${BACKUP_DIR:-/data/backups}" 2>/dev/null || true
if [ -x ./scripts/check-storage-persist.sh ]; then
  ./scripts/check-storage-persist.sh || echo "entrypoint: تحذير — تخزين /data غير ثابت؛ اربط volume دائم في Coolify" >&2
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "entrypoint: npx not found" >&2
  hold_and_exit 3
fi

./scripts/apply-pending.sh || hold_and_exit $?

echo "entrypoint: starting node server.js"
exec node server.js
