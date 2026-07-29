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
cd web
cp .env.example .env
# شغّل PostgreSQL ثم عيّن DATABASE_URL
npm install
npx prisma db push
npm run db:seed
npm run dev
```

أو عبر Docker Compose من مجلد `web`:

```bash
docker compose up --build
```

دخول المدير الافتراضي (من البذرة):

- الجوال: `0500000000`
- كلمة المرور: `Admin@1234`

## الوحدات

1. المستفيدون (تحقق هوية سعودية + استيراد Excel)
2. دعوات جماعية + QR بمعرف داخلي
3. حضور (QR/بحث) + استثناء مشرف
4. صرف يشترط الحضور + مخزون ذري
5. لوحة تحكم وتقارير Excel/PDF
6. استبيان ورسالة شكر (واتساب stub حتى نهاية التجربة)
7. تنبيه خمول الجلسة بعد ساعة

## النشر على Coolify

1. اربط المستودع بتطبيق Coolify (مجلد البناء: `web` أو Dockerfile داخل `web`)
2. عيّن متغيرات البيئة من `.env.example`
3. (اختياري) أضف سر `COOLIFY_WEBHOOK` في GitHub لتفعيل النشر التلقائي من `main`
4. اربط الدومين لاحقاً من لوحة Coolify
