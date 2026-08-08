# نشر منصة رداء — سيرفر سحابي + دومين + GitHub

> الخطوات الكاملة: **`docs/LAUNCH_STEPS.md`**  
> طوبولوجيا الإنتاج وقاعدة الترحيل: **`docs/RUNBOOK_EVENT_DAY.md` §0**

## مبدأ حماية البيانات

| عند التحديث | ممنوع |
|---|---|
| `./scripts/apply-pending.sh` ثم `node server.js` | تشغيل البذرة عند الإقلاع |
| `prisma migrate deploy` (تراكمي) | `migrate reset` / `db push` |
| Volume دائم لـ Postgres و`/data` | `docker compose down -v` |

## إقلاع الحاوية (Dockerfile CMD)

```sh
./scripts/apply-pending.sh && node server.js
```

تهيئة أول مرة (قاعدة فارغة فقط):

```bash
ADMIN_PASSWORD='…' ADMIN_MOBILE='05…' npm run init
```

## Coolify باختصار

1. Postgres دائم منفصل + تطبيق Dockerfile + volume `/data`
2. أسرار: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, …
3. بعد أول نشر ناجح: نفّذ `npm run init` مرة واحدة (exec/one-off) ثم لا تُعده
4. دومين العميل + SSL؛ `AUTH_URL` = HTTPS
5. سر GitHub اختياري: `COOLIFY_WEBHOOK` + إلزامي لـ CI: `AUTH_SECRET`
