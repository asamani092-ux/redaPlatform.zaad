#!/usr/bin/env bash
# تشغيل البذرة مرة واحدة يدوياً بعد أول نشر — لا يُستدعى تلقائياً في التحديثات.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SEED_RESET_ADMIN="${SEED_RESET_ADMIN:-0}"
export SEED_ACTIVATE_EXHIBITION="${SEED_ACTIVATE_EXHIBITION:-0}"
npx tsx prisma/seed.ts
