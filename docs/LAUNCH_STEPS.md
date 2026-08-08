# خطوات الرفع والنشر كاملة — منصة رداء

## أ) قبل الرفع — تنظيف قاعدة التطوير/التجربة

نفِّذ مرة واحدة على القاعدة التي تريد تصفيرها (يستبقي مشرف النظام فقط):

```bash
cd /path/to/redaPlatform.zaad
cp .env.example .env   # إن لم يوجد
# تأكد من DATABASE_URL الصحيح
export CONFIRM_PURGE=YES_LAUNCH
npm run db:purge-launch
```

النتيجة المتوقعة:
- مستخدم واحد: `مدير النظام` / الجوال من `ADMIN_MOBILE` (افتراضي `0500000000`)
- معرض نشط واحد فارغ + جمعيات أساسية
- لا مستفيدين / حضور / صرف / مستخدمي تجريب

دخول بعد التنظيف:
- الجوال: قيمة `ADMIN_MOBILE`
- كلمة المرور: قيمة `ADMIN_PASSWORD` (افتراضي `Admin@1234`) — غيّرها بعد الدخول

---

## ب) GitHub

1. ادفع الفرع وادمج إلى `main` بعد نجاح CI.
2. المستودع → Settings → Secrets and variables → Actions:
   - أضف `COOLIFY_WEBHOOK` = رابط Deploy Webhook من Coolify (اختياري للنشر التلقائي).
3. عند كل دفع إلى `main`: GitHub Actions يبني ويختبر؛ إن وُجد الـ webhook يستدعي Coolify.

---

## ج) السيرفر السحابي (Coolify) + قاعدة دائمة

### 1) خدمة PostgreSQL
1. في Coolify: New Resource → PostgreSQL 16.
2. فعّل **Persistent Storage** (قرص دائم) — لا تحذف هذه الخدمة عند تحديث التطبيق.
3. انسخ بيانات الاتصال: host / port / user / password / database.

### 2) تطبيق المنصة
1. New Resource → Application → ربط مستودع GitHub → الفرع `main`.
2. Build Pack: **Dockerfile** (المسار: جذر المستودع، الملف `Dockerfile`).
3. Port: `3100`.
4. أضف **Persistent Storage / Volume**:
   - Destination path داخل الحاوية: `/data`
   - هذا يحفظ النسخ الاحتياطية والمرفقات بعد كل تحديث.

### 3) متغيرات البيئة (Environment)

```env
DATABASE_URL=postgresql://USER:PASS@DB_HOST:5432/DB_NAME?schema=public
AUTH_SECRET=<ولّد سلسلة عشوائية ≥ 32 حرفاً>
AUTH_TRUST_HOST=true
AUTH_URL=https://YOUR-CLIENT-DOMAIN
NEXTAUTH_URL=https://YOUR-CLIENT-DOMAIN
ADMIN_MOBILE=05xxxxxxxx
ADMIN_PASSWORD=<كلمة قوية لأول مرة فقط>
SEED_ON_BOOT=1
SEED_RESET_ADMIN=0
BACKUP_BEFORE_MIGRATE=1
BACKUP_DIR=/data/backups
UPLOADS_DIR=/data/uploads
ALLOW_MIGRATE_WITHOUT_BACKUP=0
WHATSAPP_PROVIDER=stub
TRIAL_EVAL_ENABLED=false
```

5. انشر (Deploy) وانتظر السجلات حتى يظهر نجاح الإقلاع / البذرة.
6. **فوراً بعد أول نجاح** غيّر:

```env
SEED_ON_BOOT=0
```

ثم Redeploy مرة واحدة — بعدها أي تحديث لا يعيد البذرة ولا يمس البيانات.

---

## د) دومين العميل + SSL

1. في Coolify → التطبيق → Domains → أضف دومين العميل (مثال: `ridaa.example.org`).
2. عند مزوّد DNS: سجل `A` أو `CNAME` كما يطلب Coolify إلى IP السيرفر.
3. فعّل Let's Encrypt / SSL.
4. تأكد أن `AUTH_URL` و`NEXTAUTH_URL` = نفس رابط HTTPS بدون شرطة أخيرة زائدة.
5. افتح `https://YOUR-CLIENT-DOMAIN/login` وتأكد من الدخول.

---

## هـ) ماذا يحدث عند كل تحديث لاحق من GitHub؟

1. دمج/دفع إلى `main` → CI أخضر.
2. Coolify يعيد بناء **صورة التطبيق فقط**.
3. داخل الحاوية `boot.sh`:
   - نسخة SQL إلى `/data/backups` (volume دائم)
   - `prisma migrate deploy` فقط (إضافة ترحيلات — لا حذف)
   - تشغيل التطبيق — **بدون بذرة** إن `SEED_ON_BOOT=0`
4. قرص Postgres + volume `/data` كما هما → البيانات والمرفقات تبقى.

### ممنوع في الإنتاج
- `prisma migrate reset`
- `prisma db push`
- `docker compose down -v`
- حذف خدمة Postgres أو volume `/data`
- الإبقاء على `SEED_ON_BOOT=1` بعد الإطلاق

---

## و) نشر بديل بـ Docker Compose على السيرفر

```bash
git clone <REPO_URL> redaPlatform.zaad
cd redaPlatform.zaad
cp .env.example .env
# عدّل: AUTH_SECRET, AUTH_URL, NEXTAUTH_URL, POSTGRES_PASSWORD, ADMIN_*
nano .env

SEED_ON_BOOT=1 docker compose up -d --build
# تحقق من السجلات ثم:
# اضبط SEED_ON_BOOT=0 في .env
docker compose up -d --build
```

تحديث لاحق:

```bash
git pull origin main
docker compose up -d --build
```

**لا تستخدم:** `docker compose down -v`

---

## ز) نسخ احتياطي دوري

```bash
export DATABASE_URL='postgresql://...'
./scripts/backup.sh
./scripts/restore-drill.sh   # على قاعدة scratch فقط
```

داخل الحاوية: الملفات تحت `/data/backups`.

---

## ح) قائمة تحقق الإطلاق

- [ ] تنظيف التجربة (`db:purge-launch`) إن لزم
- [ ] Postgres دائم منفصل
- [ ] Volume `/data` مربوط
- [ ] `SEED_ON_BOOT=0` بعد أول تنصيب
- [ ] دومين + SSL + دخول يعمل
- [ ] `AUTH_URL` = HTTPS الدومين
- [ ] `TRIAL_EVAL_ENABLED=false`
- [ ] نسخة احتياطية ناجحة مرة واحدة
- [ ] تغيير كلمة مدير النظام بعد أول دخول
