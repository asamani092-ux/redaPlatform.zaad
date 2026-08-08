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
# شغّل PostgreSQL ثم عيّن DATABASE_URL
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

التطبيق يعمل على المنفذ **3100**: `http://localhost:3100`

أو عبر Docker Compose:

```bash
SEED_ON_BOOT=1 docker compose up --build
# بعد أول نجاح: SEED_ON_BOOT=0 ثم أعد التشغيل — لا تستخدم down -v
```

دخول المدير الافتراضي (من البذرة):

- الجوال: `0500000000`
- كلمة المرور: `Admin@1234`

## حماية البيانات عند النشر

- الترحيل فقط: `migrate deploy` — ممنوع `migrate reset` / `db push` على الإنتاج
- Volumes دائمة: Postgres + `/data` (نسخ ومرفقات)
- الإقلاع: `scripts/boot.sh` (نسخة قبل الترحيل → ترحيل → تشغيل؛ البذرة اختيارية)

التفاصيل: [`docs/DEPLOY.md`](docs/DEPLOY.md)

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

راجع **`docs/DEPLOY.md`** بالكامل. باختصار:

1. Postgres دائم منفصل + Volume `/data` للتطبيق
2. اربط GitHub → Coolify (Dockerfile في الجذر) + سر `COOLIFY_WEBHOOK` اختياري
3. `AUTH_URL` / `NEXTAUTH_URL` = `https://دومين-العميل`
4. `SEED_ON_BOOT=1` لأول تنصيب فقط ثم `0` دائماً
