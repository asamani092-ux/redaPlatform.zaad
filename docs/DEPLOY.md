# نشر منصة رداء — سيرفر سحابي + دومين + GitHub

## الهدف

تشغيل المنصة على سيرفر سحابي (Coolify / Docker) مربوط بـ GitHub، مع دومين العميل، **دون فقدان قاعدة البيانات أو الملفات الدائمة عند أي تحديث لاحق**.

## مبدأ حماية البيانات (إلزامي)

| مسموح عند التحديث | ممنوع |
|---|---|
| `prisma migrate deploy` (عبر `apply-pending.sh` / `boot.sh`) | `prisma migrate reset` |
| نسخ احتياطي قبل الترحيل | `prisma db push` على الإنتاج |
| إعادة بناء صورة التطبيق فقط | `docker compose down -v` / حذف volume |
| Volume دائم لـ Postgres و`/data` | تخزين بيانات تشغيل داخل طبقة الصورة |

- بيانات Postgres على volume اسمه `ridaa_pg` (أو خدمة Postgres مُدارة في Coolify مع قرص دائم).
- النسخ الاحتياطية والمرفقات على volume `ridaa_data` → المسار داخل الحاوية `/data`.
- إعادة النشر = صورة جديدة + نفس الـ volumes → البيانات تبقى.

## 1) GitHub

1. ادفع الفرع إلى المستودع ثم ادمج إلى `main` بعد نجاح CI.
2. في إعدادات المستودع → Secrets:
   - `COOLIFY_WEBHOOK` = رابط Webhook من Coolify (اختياري للنشر التلقائي عند الدفع إلى `main`).
3. سير عمل `.github/workflows/deploy.yml`: يبني ويختبر؛ عند نجاح `main` يستدعي Coolify إن وُجد السر.

## 2) Coolify على السيرفر

1. أنشئ **PostgreSQL** كخدمة مستقلة مع **Persistent Storage** — لا تحذفها عند تحديث التطبيق.
2. أنشئ تطبيق **Dockerfile** من جذر المستودع (`Dockerfile`).
3. اربط المستودع (`main`)؛ فعّل Auto Deploy إن رغبت.
4. متغيرات البيئة (من `.env.example` + أدناه):

```env
DATABASE_URL=postgresql://USER:PASS@HOST:5432/ridaa?schema=public
AUTH_SECRET=<سلسلة عشوائية طويلة ≥32>
AUTH_TRUST_HOST=true
AUTH_URL=https://DOMAIN-العميل
NEXTAUTH_URL=https://DOMAIN-العميل
ADMIN_MOBILE=05xxxxxxxx
ADMIN_PASSWORD=<فقط لأول بذرة>
SEED_ON_BOOT=1
SEED_RESET_ADMIN=0
BACKUP_BEFORE_MIGRATE=1
BACKUP_DIR=/data/backups
UPLOADS_DIR=/data/uploads
WHATSAPP_PROVIDER=stub
TRIAL_EVAL_ENABLED=false
```

5. أضف **Persistent Volume** على المسار `/data` في حاوية التطبيق.
6. أول نشر ناجح: بعد ظهور «Seed OK» في السجلات، غيّر فوراً:

```env
SEED_ON_BOOT=0
```

ثم أعد النشر مرة واحدة — بعدها التحديثات لا تعيد البذرة.

7. الدومين: من Coolify → Domains → أضف دومين العميل + SSL (Let's Encrypt).
8. حدّث `AUTH_URL` و`NEXTAUTH_URL` لنفس الـ HTTPS.

## 3) نشر بـ Docker Compose على السيرفر

```bash
git clone <repo> && cd redaPlatform.zaad
cp .env.example .env
# عدّل AUTH_SECRET و AUTH_URL و كلمات المرور
SEED_ON_BOOT=1 docker compose up -d --build
# بعد أول نجاح:
# SEED_ON_BOOT=0 في .env ثم:
docker compose up -d --build
```

**ممنوع:** `docker compose down -v` — يحذف `ridaa_pg` و`ridaa_data`.

للتحديث لاحقاً:

```bash
git pull
./scripts/backup.sh   # إن توفّر DATABASE_URL من المضيف
docker compose up -d --build
```

الإقلاع داخل الحاوية يشغّل تلقائياً: نسخ → ترحيل → تشغيل (بدون بذرة إن `SEED_ON_BOOT=0`).

## 4) النسخ الاحتياطي والاسترجاع

```bash
# من مضيف يصل لقاعدة الإنتاج
export DATABASE_URL=...
./scripts/backup.sh
./scripts/restore-drill.sh   # على قاعدة scratch فقط — لا يمس الإنتاج
```

داخل الحاوية: الملفات تحت `/data/backups` (volume دائم).

استرجاع إنتاج (يدوي، بعد عزل النسخة الحالية):

```bash
# أوقف الكتابة، خذ نسخة حالية أولاً، ثم استعد من ملف SQL موثّق
psql "$DATABASE_URL_WITHOUT_SCHEMA" -f backups/ridaa-YYYYMMDD….sql
```

## 5) قائمة تحقق قبل الإطلاق

- [ ] Postgres على قرص/volume دائم منفصل عن حاوية التطبيق
- [ ] Volume `/data` مربوط للتطبيق
- [ ] `SEED_ON_BOOT=0` بعد أول تنصيب
- [ ] `AUTH_URL` / `NEXTAUTH_URL` = HTTPS الدومين
- [ ] `AUTH_SECRET` قوي وغير مُشارَك مع التطوير
- [ ] `TRIAL_EVAL_ENABLED=false` في الإنتاج
- [ ] نسخة احتياطية ناجحة + `restore-drill` مرة واحدة على بيئة scratch
- [ ] لا يوجد أمر `migrate reset` أو `db push` في مسار الإنتاج
- [ ] دومين العميل + شهادة SSL تعمل على صفحة الدخول

## 6) ماذا يحدث عند تحديث لاحق من GitHub؟

1. CI ينجح على `main`.
2. Coolify يعيد بناء الصورة.
3. `boot.sh`: نسخة SQL → `migrate deploy` فقط → تشغيل.
4. Volumes كما هي → **لا حذف للمستفيدين/الحضور/الصرف/المرفقات**.
