# أمر الوكيل — تحسين واجهة المنصة بالمكوّنات الإضافية

> الصق محتوى «نص النسخ للوكيل» أدناه في محادثة وكيل كل منصة، أو نفّذ هذا الملف كاملاً.

---

## ماذا حصل (السياق)

1. مصدر التصميم الوحيد: `asamani092-ux/designSystemFinal` → الحزمة `@zaad/design-system` (`#v1.2.0`).
2. النسخ المحلية (`Design_system_f` / `Zaad.design.system` / `design-system` المكرر) تُحذف بعد الربط.
3. **المهمة الأساسية:** تحسين واجهات هذه المنصة باستخدام **المكوّنات الإضافية** من دليل الهوية (من ٦·٩ فما فوق) وعقود `components.md` — وليس مجرد استيراد CSS.
4. المنصات: `redaPlatform` · `mqiasPlatform` · `itsalplatform` · `tkafulPlatform` · `tmkeenpPlatform`.

## تحليل الخوارزمية (إلزامي قبل التنفيذ)

- **الزمن:** الربط O(1)؛ جرد الشاشات وتطبيق المكوّنات الإضافية O(S×C) حيث S=الشاشات وC=المكوّنات المطبقة لكل شاشة.
- **المكان:** اعتمادية واحدة بلا نسخ محلية → O(1).

## المكوّنات الإضافية المطلوب تطبيقها (حسب حاجة الشاشات)

طبّق ما ينطبق على شاشات المنصة فقط — لا تُنشئ شاشات وهمية:

| المجموعة | المكوّنات |
|----------|-----------|
| ٦·٩ إضافية | Breadcrumb · Chips/Tags · AvatarGroup · Modal · Stepper · Accordion · EmptyState · Pagination |
| ٦·١٠–١١ | بطاقة عرض تفصيلي · بطاقة مستفيد · معاينة جوال |
| ٦·١٢ | شاشات المصادقة / إدارة الحساب بنفس العقود والأنماط |
| ٦·١٣ موسّعة | Toast · Tabs segmented · FilterBar · ConfirmDialog · Skeleton |
| ٦·١٤ | Profile Drawer / SlideOver (RTL من `inline-start`) |
| ٦·١٥–١٧ | رأس تقرير · معايير · جداول تقارير · TaskCard · نماذج مهام/استبيان/استقبال طلبات إن وُجدت في المنصة |
| من العقود | Button · TextField · Select · Badge · Card · DataTable · Sidebar · TopBar · KPI · Progress · Dropzone |

المرجع: `@zaad/design-system/components.md` + أقسام المكوّنات في دليل الهوية بالمستودع المركزي.

---

## نص النسخ للوكيل (انسخه كاملاً)

```text
اقرأ AGENT_COMMAND.md في جذر هذا المستودع ونفّذه بالكامل.

الهدف الرئيسي: تحسين واجهة هذه المنصة باستخدام المكوّنات الإضافية من نظام الزاد الموحّد — ليس استيراد ملفات فقط.

نفّذ بالترتيب:
1) اربط الحزمة:
   "@zaad/design-system": "github:asamani092-ux/designSystemFinal#v1.2.0"
   ثم tokens.css + components.css + tailwind.preset + class zad-root و dir=rtl.
2) احذف Design_system_f و Zaad.design.system وأي design-system محلي مكرر بعد نجاح البناء.
3) اجرد شاشات الواجهة الحالية (صفحات، نماذج، جداول، لوحات، أدراج، نوافذ).
4) حسّن كل شاشة ذات صلة بالمكوّنات الإضافية التالية حيث تنطبق:
   Breadcrumb, Chips/Tags, AvatarGroup, Modal/Dialog, Stepper, Accordion,
   EmptyState, Pagination, بطاقة عرض تفصيلي, بطاقة مستفيد,
   Toast, Tabs, FilterBar, ConfirmDialog, Skeleton,
   Profile Drawer/SlideOver, DataTable, Badge, Card, KPI, Progress, Dropzone,
   ونماذج المهام/الاستبيان/استقبال الطلبات إن وُجدت في المنصة.
5) التنفيذ الداخلي فقط: لا تغيّر أسماء الدوال أو المعاملات المربوطة بالـ UI.
6) كل لون/مسافة/ظل من var(--*) أو فئات النظام — ممنوع قيم صريحة.
7) RTL منطقي (text-start / inline-start) + وصول (تركيز مرئي، تباين، لمس ≥ 44px).
8) اقرأ العقود من node_modules/@zaad/design-system/components.md قبل تنفيذ أي مكوّن.
9) npm install && npm run build يجب أن ينجح.
10) فرع + commit + push + PR يذكر: الربط، الحذف، وقائمة الشاشات والمكوّنات الإضافية التي طُبّقت.

قبل أي كود: اذكر Big O (الزمن/المكان). إن نقص معطى تقني توقف واسأل — لا تخمّن.
لا تنسخ ملفات التصميم داخل المنصة. لا توسّع API أو قاعدة البيانات.
```

---

## أ) الربط التقني

1. أضف في `package.json`:

```json
"@zaad/design-system": "github:asamani092-ux/designSystemFinal#v1.2.0"
```

2. Tailwind: `presets: [zaadPreset]` من `@zaad/design-system/tailwind.preset`.
3. في الأنماط العامة:

```css
@import "@zaad/design-system/tokens.css";
@import "@zaad/design-system/components.css";
```

4. الجذر: `lang="ar" dir="rtl"` + `zad-root`.
5. احذف النسخ المحلية بعد نجاح البناء.
6. `npm install` ثم `npm run build`.

## ب) تحسين الواجهة بالمكوّنات الإضافية

1. اقرأ `components.md` من الحزمة قبل التنفيذ.
2. **ثبات الواجهات:** لا إعادة تسمية props/دوال مربوطة بالـ UI.
3. استبدل الأنماط المخصصة بمكوّنات/فئات النظام + توكنات.
4. لكل مكوّن إضافي طُبّق: الحالات default / hover / focus-visible / disabled / loading / error / empty حيث تنطبق.
5. Drawer يفتح من `inline-start` في RTL.
6. نطاق الدقة: ملفات الواجهة والأنماط فقط.

## ج) التسليم

1. فرع حسب سياسة المستودع.
2. Commit: ربط الحزمة + حذف النسخ + تطبيق المكوّنات الإضافية على الشاشات.
3. PR فيه جدول: الشاشة → المكوّنات الإضافية المطبّقة.

## ممنوع

- نسخ ملفات التصميم داخل المنصة.
- قيم لون/مسافة صريحة.
- كسر واجهات المكوّنات العامة.
- تخمين شاشات أو مكوّنات غير موجودة في المنصة.
