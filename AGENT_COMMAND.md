# أمر الوكيل — ربط المنصة بنظام التصميم المركزي وتحسين الواجهة

> الصق هذا الملف كاملاً كتعليمات لوكيل Cursor على مستودع المنصة المستهدفة.

---

## ماذا حصل (السياق)

1. **مصدر الحقيقة الوحيد** أصبح المستودع: `asamani092-ux/designSystemFinal` (الحزمة `@zaad/design-system`).
2. نُسخ التصميم المحلية داخل المنصات (`Design_system_f` / `Zaad.design.system` / `design-system` المنسوخة) **ملغاة** ويجب حذفها بعد الربط.
3. أي تحسين لاحق على التوكنات أو عقود المكوّنات يتم في `designSystemFinal` فقط، ثم ينعكس على المنصات برفع إصدار الاعتمادية.
4. المنصات المعتمدة لهذا الربط:
   - `asamani092-ux/redaPlatform.zaad`
   - `asamani092-ux/mqiasPlatform.zaad`
   - `asamani092-ux/itsalplatform.zaad`
   - `asamani092-ux/tkafulPlatform.zaad`
   - `asamani092-ux/tmkeenpPlatform.zaad`

## تحليل الخوارزمية (إلزامي قبل التنفيذ)

- **الزمن:** ربط المنصة O(1) خطوات ثابتة؛ مسح الشاشات واستبدال الأنماط O(S) حيث S = عدد صفحات/مكوّنات الواجهة.
- **المكان:** لا تُنسخ ملفات التصميم داخل المنصة؛ الاعتمادية فقط → O(1) مساحة إضافية مقابل النسخ السابقة.

## مهمتك على هذه المنصة (نفّذ بالترتيب)

### أ) الربط التقني

1. أضف الاعتمادية في `package.json`:

```json
"@zaad/design-system": "github:asamani092-ux/designSystemFinal#v1.2.0"
```

2. اربط Tailwind:

```ts
import zaadPreset from "@zaad/design-system/tailwind.preset";
export default { presets: [zaadPreset], content: [/* مسارات المشروع */] };
```

3. في ملف الأنماط العام (`globals.css` أو ما يعادله):

```css
@import "@zaad/design-system/tokens.css";
@import "@zaad/design-system/components.css";
```

4. على الجذر: `lang="ar" dir="rtl"` و class `zad-root` (أو أبقِ `tmkeen-root` مؤقتاً — التوافق موجود).

5. احذف المجلدات المحلية المنسوخة بعد نجاح البناء:
   - `Design_system_f`
   - `Zaad.design.system`
   - أي `design-system/` محلي مكرر (ليس استيراد الحزمة)

6. نفّذ `npm install` ثم `npm run build` وتأكد من نجاح البناء.

### ب) تحسين الواجهة بالمكوّنات الجديدة

1. اقرأ عقد المكوّنات من الحزمة: `@zaad/design-system/components.md` (أو من المستودع المركزي `package/components.md`).
2. **ثبات الواجهات:** لا تُغيّر أسماء الدوال/المعاملات المربوطة بالـ UI؛ عدّل التنفيذ الداخلي والأنماط فقط.
3. استبدل الألوان والقيم الصريحة بـ `var(--*)` من التوكنات أو فئات النظام (`.btn-primary`, `.card`, `.badge-*`, `.input-field`, …).
4. طبّق عقود المكوّنات (Button / TextField / Select / Card / Badge / Modal / Drawer / Table / Tabs …) حسب الشاشات الموجودة — حالة واحدة لكل عنصر: default / hover / focus-visible / disabled / loading / error حيث تنطبق.
5. التزم بـ RTL المنطقي: `inline-start/end` و `text-start` — ممنوع `left/right` للمحتوى العربي.
6. الوصول شرط قبول: تباين، تركيز مرئي، لمس ≥ 44px، عناصر أصلية أو ARIA مطابق.
7. نطاق الدقة: عدّل ملفات الواجهة والأنماط فقط؛ لا توسّع نطاق الـ API/قاعدة البيانات.

### ج) التسليم

1. فرع: `cursor/consume-zaad-design-<وصف>-6d93` (أو وفق سياسة المستودع).
2. Commit يوضح: ربط `@zaad/design-system` + حذف النسخ المحلية + تحسين الشاشات حسب العقود.
3. Push + PR مع قائمة الشاشات التي حُسّنت.

## ممنوع

- إعادة نسخ ملفات التصميم داخل المنصة.
- قيم لون/مسافة صريحة بدل التوكنات.
- كسر واجهات المكوّنات العامة (إعادة تسمية props/دوال مربوطة).
- تخمين متطلبات غير موجودة في العقود أو في شاشات المنصة.
