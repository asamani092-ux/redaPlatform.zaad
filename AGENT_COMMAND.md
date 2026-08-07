# أمر المنصة — تحديث التصميم

> يُفعَّل تلقائياً عند رسالة: **تم تحديث ملف التصميم**

## ماذا تفعل (بالترتيب)

1. اقرأ `VERSION` من مستودع التصميم أو ثبّت الوسم من `package.json` هناك → اعتمدية:
   `"@zaad/design-system": "github:asamani092-ux/designSystemFinal#v1.2.11"`
2. اربط في الأنماط العامة فقط:
   `tokens.css` + `components.css` + `zaad-addons.css` + `tailwind.preset` + `zad-root` + `dir=rtl`.
3. احذف كل نسخة تصميم محلية: `Design_system_f` · `Zaad.design.system` · `design-system` المكرر · `zaad-addons.css` المحلي · أي `tokens.css`/`components.css` منسوخ.
4. حسّن واجهات المنصة الموجودة وفق عقود الحزمة — اقرأ من `components.md` **فقط** أقسام المكوّنات الظاهرة في الشاشات الحالية.
5. لا تُعدّل أسماء دوال/معاملات الـ UI. لا قيم لون/مسافة صريحة. RTL منطقي.
6. `npm install && npm run build` ثم فرع + PR يذكر الشاشات المحدّثة.

## Big O
ربط O(1) · تحسين الشاشات O(S) · بلا نسخ ملفات تصميم.

## ممنوع
تخمين شاشات غير موجودة · قراءة ملفات الدليل HTML الكاملة بلا داعٍ · إعادة نسخ التصميم داخل المنصة.
