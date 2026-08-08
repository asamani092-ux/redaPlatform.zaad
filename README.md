# منصة معرض رداء

منصة عربية (RTL) لإدارة المستفيدين، الدعوات، الحضور، صرف القطع، المخزون، التقارير، والاستبيان — بهوية نظام تصميم Zaad/Tmkeen.

## التقنية

- Next.js 15 (App Router)
- Prisma 7 + PostgreSQL
- NextAuth (جوال + كلمة مرور)
- ExcelJS للتصدير/الاستيراد
- نشر: GitHub Actions → Coolify على Hetzner

## التشغيل المحلي

```bash
cp .env.example .env
# عيّن DATABASE_URL و AUTH_SECRET و ADMIN_PASSWORD
npm install
npm run db:migrate
npm run init
npm run dev
```

التطبيق على المنفذ **3100**: `http://localhost:3100`

Docker Compose (بيانات على volumes — ممنوع `down -v`):

```bash
docker compose up -d --build
docker compose run --rm -e ADMIN_PASSWORD -e ADMIN_MOBILE -e DATABASE_URL web npm run init
```

بعد أول دخول: غيّر كلمة مدير النظام فوراً.

## حماية البيانات عند النشر

- إقلاع الحاوية: `apply-pending.sh && node server.js` فقط — **بلا بذرة**
- تهيئة مرة واحدة: `npm run init` على قاعدة فارغة
- ترحيل تراكمي فقط — ممنوع `migrate reset` / `db push` على الإنتاج
- Postgres دائم منفصل + volume `/data`

التفاصيل: [`docs/LAUNCH_STEPS.md`](docs/LAUNCH_STEPS.md) · [`docs/DEPLOY.md`](docs/DEPLOY.md) · [`docs/RUNBOOK_EVENT_DAY.md`](docs/RUNBOOK_EVENT_DAY.md)

## الوحدات

1. المستفيدون (تحقق هوية سعودية + استيراد Excel)
2. دعوات جماعية + QR بمعرف داخلي
3. حضور (QR/بحث/كاميرا) + استثناء مشرف
4. صرف يشترط الحضور + مخزون ذري
5. لوحة تحكم وتقارير Excel/PDF
6. إدارة المعارض (نشط واحد) وإعدادات لكل معرض
7. استبيان ورسالة شكر (واتساب stub حتى نهاية التجربة)
8. تنبيه خمول الجلسة بعد ساعة

## النشر على Coolify + دومين العميل

راجع **`docs/LAUNCH_STEPS.md`**. باختصار: Postgres دائم → تطبيق Dockerfile → volume `/data` → أسرار البيئة → `npm run init` مرة واحدة → دومين HTTPS → `AUTH_URL`.
