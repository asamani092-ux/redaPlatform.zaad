#!/usr/bin/env sh
# إقلاع الإنتاج: تهيئة /data ثم ترحيل تراكمي ثم الخادم — بلا بذرة.
# يعمل أولاً كـ root لضبط صلاحيات الحجم الدائم، ثم ينتقل إلى nextjs.
set -eu

hold_and_exit() {
  code="${1:-1}"
  echo "entrypoint: FATAL exit=${code} — holding 120s for log capture" >&2
  sleep 120
  exit "${code}"
}

UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"

prepare_data_dirs() {
  echo "entrypoint: preparing persistent /data as root"
  mkdir -p "${UPLOADS_DIR}/evidence" "${BACKUP_DIR}"
  # لا نلمس ملكية جذر /data إن منعه Coolify — نضبط المجلدات الفرعية
  chown -R nextjs:nodejs "${UPLOADS_DIR}" "${BACKUP_DIR}" 2>/dev/null \
    || chown -R nextjs:nodejs "${UPLOADS_DIR}/evidence" 2>/dev/null \
    || true
  chmod 750 "${UPLOADS_DIR}" "${UPLOADS_DIR}/evidence" "${BACKUP_DIR}" 2>/dev/null || true
  # إن كان /data قابل للتعديل
  chmod 755 /data 2>/dev/null || true
  chown nextjs:nodejs /data 2>/dev/null || true
}

# جذر الحجم غالباً مملوك لـ root بعد ربط Coolify — حضّر ثم انزل لصلاحية nextjs
if [ "$(id -u)" = "0" ]; then
  prepare_data_dirs
  if [ -x ./scripts/check-storage-persist.sh ]; then
    ./scripts/check-storage-persist.sh \
      || echo "entrypoint: تحذير — راجع ربط/جاهزية /data" >&2
  fi
  echo "entrypoint: dropping privileges to nextjs"
  exec su-exec nextjs:nodejs "$0" --as-nextjs
fi

echo "entrypoint: boot begin PORT=${PORT:-3100} uid=$(id -u)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "entrypoint: DATABASE_URL missing at runtime" >&2
  hold_and_exit 1
fi

echo "entrypoint: DATABASE_URL present (chars=${#DATABASE_URL})"
node -e "try{const u=new URL(process.env.DATABASE_URL); console.log('entrypoint: db='+u.protocol+'//'+u.hostname+':'+ (u.port||'5432') + u.pathname)}catch(e){console.error('entrypoint: DATABASE_URL unparseable'); process.exit(2)}" \
  || hold_and_exit 2

# محاولة لطيفة إن شُغّل الدخول مسبقاً كـ nextjs بدون root
mkdir -p "${UPLOADS_DIR}/evidence" "${BACKUP_DIR}" 2>/dev/null || true

if [ -x ./scripts/check-storage-persist.sh ]; then
  ./scripts/check-storage-persist.sh \
    || echo "entrypoint: تحذير — تخزين /data غير جاهز للكتابة" >&2
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "entrypoint: npx not found" >&2
  hold_and_exit 3
fi

./scripts/apply-pending.sh || hold_and_exit $?

if [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "entrypoint: ensure admin if database has no users"
  npm run db:ensure-admin-if-empty \
    || echo "entrypoint: تحذير — فشل ensure-admin-if-empty (قد تحتاج npm run db:ensure-admin يدوياً)" >&2
else
  echo "entrypoint: ADMIN_PASSWORD غير مضبوط — تخطي ensure-admin-if-empty"
fi

echo "entrypoint: starting node server.js"
exec node server.js
