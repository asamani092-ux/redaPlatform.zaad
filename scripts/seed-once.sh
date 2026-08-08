#!/usr/bin/env bash
# تهيئة لمرة واحدة — يستدعي npm run init (يتطلب ADMIN_PASSWORD في البيئة).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run init
