#!/usr/bin/env bash
# إقلاع إنتاج آمن: نسخ احتياطي → ترحيل فقط → بذرة اختيارية → تشغيل API.
# ممنوع هنا: migrate reset / db push / DROP / حذف volumes.
# Time: O(حجم القاعدة للنسخ) — Space: O(حجم الملف).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "boot: DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"
mkdir -p "$BACKUP_DIR" "$UPLOADS_DIR"

# ——— 1) نسخ احتياطي قبل أي ترحيل (افتراضي مفعّل) ———
if [[ "${BACKUP_BEFORE_MIGRATE:-1}" == "1" ]]; then
  if command -v pg_dump >/dev/null 2>&1; then
    STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
    OUT="${BACKUP_DIR}/ridaa-pre-migrate-${STAMP}.sql"
    PGURL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.search=''; console.log(u.toString())")"
    echo "boot: pre-migrate backup → ${OUT}"
    if pg_dump --no-owner --no-privileges --format=plain "$PGURL" > "$OUT" 2>/tmp/boot-pgdump.err; then
      if [[ ! -s "$OUT" ]]; then
        echo "boot: backup empty — aborting migrate to protect data" >&2
        exit 1
      fi
      ln -sfn "$(basename "$OUT")" "${BACKUP_DIR}/latest.sql"
      # احتفظ بآخر 30 نسخة فقط داخل المجلد الدائم
      ls -1t "${BACKUP_DIR}"/ridaa-*.sql 2>/dev/null | tail -n +31 | xargs -r rm -f
      echo "boot: backup ok bytes=$(wc -c < "$OUT")"
    else
      # قاعدة جديدة فارغة: أول إقلاع قد يفشل الاتصال أو لا جداول بعد
      if grep -qiE 'does not exist|Connection refused|could not connect' /tmp/boot-pgdump.err 2>/dev/null; then
        echo "boot: backup skipped (DB not ready / first boot) — continuing"
        rm -f "$OUT"
      else
        echo "boot: backup FAILED — refuse migrate" >&2
        cat /tmp/boot-pgdump.err >&2
        exit 1
      fi
    fi
  else
    echo "boot: pg_dump missing — set BACKUP_BEFORE_MIGRATE=0 only if external DB backups exist" >&2
    if [[ "${ALLOW_MIGRATE_WITHOUT_BACKUP:-0}" != "1" ]]; then
      exit 1
    fi
  fi
else
  echo "boot: BACKUP_BEFORE_MIGRATE=0 — skipping local dump"
fi

# ——— 2) ترحيلات Prisma فقط (لا reset / لا push) ———
./scripts/apply-pending.sh

# ——— 3) بذرة أول تنصيب فقط ———
if [[ "${SEED_ON_BOOT:-0}" == "1" ]]; then
  echo "boot: SEED_ON_BOOT=1 — running seed (safe upsert)"
  npx tsx prisma/seed.ts
else
  echo "boot: seed skipped (SEED_ON_BOOT!=1)"
fi

# ——— 4) تشغيل التطبيق ———
echo "boot: starting server"
exec node server.js
