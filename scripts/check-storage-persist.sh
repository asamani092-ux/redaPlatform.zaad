#!/usr/bin/env sh
# فحص ثبات مسار التخزين (رفع/شواهد) قبل اعتبار النشر جاهزاً.
# مسار المنصة: /data (UPLOADS_DIR=/data/uploads) — ليس /app/storage.
# ملاحظة: mkdir داخل الحاوية لا يكفي؛ يلزم Persistent Storage من Coolify على /data.
set -eu

DATA_ROOT="${APP_STORAGE:-/data}"
UPLOADS="${UPLOADS_DIR:-${DATA_ROOT}/uploads}"
EVIDENCE="${UPLOADS}/evidence"

echo "منصة رداء — فحص ثبات التخزين"
echo "DATA_ROOT=$DATA_ROOT UPLOADS=$UPLOADS EVIDENCE=$EVIDENCE"
echo

is_persistent_mount() {
  path="$1"
  if [ ! -d "$path" ] && [ ! -e "$path" ]; then
    return 1
  fi
  if mountpoint -q "$path" 2>/dev/null; then
    return 0
  fi
  # بعض البيئات لا توفّر mountpoint — اعتمد findmnt
  FM="$(findmnt -no SOURCE,FSTYPE,TARGET -T "$path" 2>/dev/null || true)"
  [ -n "$FM" ] || return 1
  # إن كان الهدف نفسه المسار وليس مجرد وراثة من / (overlay الجذر)
  TARGET="$(findmnt -no TARGET -T "$path" 2>/dev/null || true)"
  SOURCE="$(findmnt -no SOURCE -T "$path" 2>/dev/null || true)"
  FSTYPE="$(findmnt -no FSTYPE -T "$path" 2>/dev/null || true)"
  # مسار مربوط إن كان TARGET يساوي المسار أو أحد آبائه غير /
  case "$TARGET" in
    "$path"|"$DATA_ROOT") ;;
    *)
      # إن كان الـ SOURCE مختلف عن جذر الحاوية overlay فقط عند / 
      if [ "$TARGET" = "/" ] || echo "$FSTYPE" | grep -Eqi '^(overlay|tmpfs)$'; then
        return 1
      fi
      ;;
  esac
  if echo "$FSTYPE" | grep -Eqi '^(overlay|tmpfs)$' && [ "$TARGET" = "/" ]; then
    return 1
  fi
  if echo "$SOURCE" | grep -Eqi 'volume|_data|bind|nfs' \
    || echo "$FSTYPE" | grep -Eqi 'nfs|fuse' \
    || mountpoint -q "$DATA_ROOT" 2>/dev/null; then
    return 0
  fi
  # Docker named volume غالباً: TARGET=/data و FSTYPE ليس overlay
  if [ "$TARGET" = "$DATA_ROOT" ] || [ "$TARGET" = "$path" ]; then
    if ! echo "$FSTYPE" | grep -Eqi '^(overlay|tmpfs)$'; then
      return 0
    fi
  fi
  return 1
}

check_one() {
  APP_STORAGE="$1"
  echo "=== فحص: $APP_STORAGE ==="
  if [ ! -d "$APP_STORAGE" ]; then
    echo "النتيجة: المجلد غير موجود — أنشئه واربطه كتخزين دائم"
    echo "(لا مخرجات findmnt)"
    return 1
  fi
  echo "--- findmnt ---"
  findmnt -T "$APP_STORAGE" 2>/dev/null || echo "(لا مخرجات findmnt)"
  if is_persistent_mount "$APP_STORAGE" || is_persistent_mount "$DATA_ROOT"; then
    echo "النتيجة: يبدو ثابتاً (مربوط بمجلد دائم)"
    return 0
  fi
  echo "النتيجة: غير ثابت — سيُستبدل عند إعادة النشر"
  return 2
}

STATUS=0
check_one "$DATA_ROOT" || STATUS=$?
echo
check_one "$UPLOADS" || true
echo

echo "=== ملخص نهائي ==="
if [ "$STATUS" -eq 0 ]; then
  echo "النتيجة النهائية: ثابت"
  exit 0
elif [ ! -d "$DATA_ROOT" ]; then
  echo "النتيجة النهائية: غير ثابت (المجلد غير موجود)"
  cat <<'EOF'
Coolify — أضف Persistent Storage ثم احفظ وأعد النشر:
  مسار السيرفر: /data/reda/storage
  مسار الحاوية: /data
ثم من Terminal الحاوية:
  mkdir -p /data/uploads/evidence /data/backups
  chmod 750 /data /data/uploads /data/uploads/evidence
  ./scripts/check-storage-persist.sh
EOF
  exit 1
else
  echo "النتيجة النهائية: غير ثابت"
  cat <<'EOF'
Coolify — المسار موجود داخل الصورة فقط؛ اربط حجم دائم على /data ثم أعد النشر.
لا تكتفِ بـ mkdir داخل الحاوية دون ربط من Coolify.
EOF
  exit 2
fi
