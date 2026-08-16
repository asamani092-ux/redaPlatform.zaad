# خطوات الرفع والنشر كاملة — منصة رداء

## أ) تنظيف قاعدة التجربة (اختياري قبل الإطلاق)

```bash
export CONFIRM_PURGE=YES_LAUNCH
export ADMIN_PASSWORD='كلمة-قوية'
npm run db:purge-launch
```

يستبقي مشرف النظام فقط. غيّر كلمة المرور بعد أول دخول.

---

## ب) GitHub

1. ادفع/ادمج إلى `main` بعد نجاح CI.
2. Secrets:
   - `AUTH_SECRET` — إلزامي لـ CI (لا يُخزَّن حرفياً في workflow)
   - `COOLIFY_WEBHOOK` — اختياري للنشر التلقائي

---

## ج) Coolify + Postgres دائم

1. أنشئ PostgreSQL مع Persistent Storage.
2. أنشئ تطبيق Dockerfile من جذر المستودع؛ Port `3100`.
3. Volume دائم على `/data` (Persistent Storage في Coolify):
   - مسار السيرفر: `/data/reda/storage`
   - مسار الحاوية: `/data`
4. بعد النشر من Terminal الحاوية:

```bash
# إن ظهر Permission denied — نفّذ كـ root مرة واحدة (أو أعد النشر بعد إصلاح entrypoint):
mkdir -p /data/uploads/evidence /data/backups
chown -R nextjs:nodejs /data/uploads /data/backups
chmod 750 /data/uploads /data/uploads/evidence /data/backups
./scripts/check-storage-persist.sh
# المطلوب: النتيجة النهائية: ثابت وجاهز للكتابة
```

لا تكتفِ بـ `mkdir` دون ربط الحجم من Coolify — وإلا تُمسح الملفات عند إعادة النشر.

5. متغيرات البيئة:

```env
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB?schema=public
AUTH_SECRET=<عشوائي ≥32>
AUTH_TRUST_HOST=true
AUTH_URL=https://YOUR-CLIENT-DOMAIN
NEXTAUTH_URL=https://YOUR-CLIENT-DOMAIN
ADMIN_MOBILE=05xxxxxxxx
ADMIN_PASSWORD=<لقيمة init فقط — لا تُستخدم عند الإقلاع>
WHATSAPP_PROVIDER=stub
TRIAL_EVAL_ENABLED=false
BACKUP_DIR=/data/backups
UPLOADS_DIR=/data/uploads
```

6. في Coolify: اجعل `DATABASE_URL` و`AUTH_SECRET` و`ADMIN_PASSWORD` **Available at Runtime فقط** (ليس Buildtime). صورة البناء تستخدم placeholder داخلي لـ `next build`.
7. Domains: أضف `redaa.alzaad.org.sa` على **نفس** مورد التطبيق (Port Exposes `3100`) وفعّل SSL.
8. Deploy — الإقلاع: ترحيل فقط ثم `node server.js` (**بلا بذرة**). عند فشل الإقلاع تبقى الحاوية ~120 ثانية لالتقاط السجلات.
9. One-off مرة واحدة على القاعدة الفارغة:

```bash
# من Coolify Terminal على حاوية التطبيق
npm run init
# إن رُفض الدخول لاحقاً:
npm run db:reset-admin
```

10. احذف/أخفِ `ADMIN_PASSWORD` من بيئة التشغيل بعد init إن أمكن؛ غيّر كلمة المدير من الواجهة.

---

## د) دومين العميل + SSL

1. Coolify → Domains → أضف الدومين + Let's Encrypt.
2. DNS: A/CNAME كما يوجّه Coolify.
3. تأكد `AUTH_URL` / `NEXTAUTH_URL` = نفس HTTPS.
4. افتح `/login` وتحقق من الدخول ثم **تدوير كلمة المدير فوراً**.

---

## هـ) تحديث لاحق من GitHub

1. دفع إلى `main` → CI.
2. Coolify يعيد بناء الصورة.
3. CMD: `apply-pending` → `node server.js` فقط.
4. Volumes كما هي → لا مساس بكلمة المدير / المستفيدين / الإعدادات.

### ممنوع
- بذرة عند كل إقلاع
- `migrate reset` / `db push`
- `docker compose down -v`
- ترحيل هدّام (حذف/إعادة تسمية عمود) دون خطة expand–contract

---

## و) Docker Compose على السيرفر

```bash
git clone <REPO> && cd redaPlatform.zaad
cp .env.example .env   # AUTH_SECRET + ADMIN_PASSWORD + AUTH_URL
docker compose up -d --build
docker compose run --rm web npm run init
```

تحديث: `git pull && docker compose up -d --build`

---

## ز) قائمة تحقق

- [ ] Postgres دائم منفصل عن صورة التطبيق
- [ ] Volume `/data`
- [ ] `npm run init` مرة واحدة فقط
- [ ] تدوير كلمة المدير بعد أول دخول
- [ ] دومين + SSL + `AUTH_URL`
- [ ] سر `AUTH_SECRET` في GitHub
- [ ] `TRIAL_EVAL_ENABLED=false`
