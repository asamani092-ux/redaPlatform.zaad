import { NAV_ITEMS } from "@/lib/rbac";

/** تقييمات ثابتة لقائمة قبول التجربة */
export const TRIAL_EVAL_RATINGS = ["غير مجرّب", "يعتمد", "يحتاج تحسين"] as const;
export type TrialEvalRating = (typeof TRIAL_EVAL_RATINGS)[number];

export type TrialEvalTool = {
  tool: string;
  path: string;
  verify: string;
};

/**
 * ما يُتحقق منه لكل مسار ظاهر في التنقل أو شاشة الدخول — مستخرج من الشاشات الفعلية لا من اختراع وحدات.
 * زمن البناء O(n)، مساحة O(n).
 */
const VERIFY_BY_PATH: Record<string, string> = {
  "/login":
    "الدخول بالجوال وكلمة المرور؛ نسيت كلمة المرور تفتح تعديل كلمة المرور بعد الجوال؛ رفض البيانات الخاطئة",
  "/dashboard":
    "ظهور مؤشرات المعرض النشط؛ عرض الأصناف الأكثر صرفاً بتسميات عربية كاملة دون اختصار",
  "/beneficiaries":
    "بحث؛ إضافة؛ تحميل نموذج Excel ثم تعبئته ورفعه؛ إخفاء الإضافة عن الاستقبال",
  "/invites":
    "دعوة وإرسال QR واتساب؛ طباعة قائمة المدعوين فقط بهوية المنصة مع الباركود",
  "/attendance":
    "المسح بالكاميرا أو البحث؛ بطاقة معاينة؛ منع التكرار؛ استثناء بسبب؛ رفض رمز غير تابع للمعرض",
  "/dispense":
    "يشترط الحضور؛ كميات ضمن الاستحقاق؛ حقل الإضافة فوق الاستحقاق وليس بديلاً عنه؛ سبب عند الإضافة",
  "/inventory":
    "إضافة صنف بسمات عربية (الوحدة ضمن السمات)؛ حقول كمية نصية تدعم الأرقام العربية؛ تنبيه النفاد",
  "/reports":
    "عرض الملخص حسب المعرض؛ تصدير جداول وملف للطباعة؛ للمدير اختيار معرض دون تبديل النشط",
  "/survey":
    "تحرير الأسئلة؛ بث الرابط؛ استقبال وعرض الردود المرتبطة بالمعرض النشط",
  "/exhibitions":
    "إنشاء بمعرض فريد؛ حالات قادم/جاري/منتهٍ/نشط؛ تفعيل معرض تشغيلي واحد",
  "/settings":
    "أقسام في نوافذ عائمة؛ سمات مخزون بتسمية عربية ومفتاح مخفي؛ قوالب وربط واتساب",
  "/users":
    "إضافة وتعديل وحذف وتغيير كلمة المرور؛ منع تكرار الجوال",
  "/audit":
    "عرض سجل العمليات الأخيرة مع المستخدم والكيان والوقت دون أعطال",
};

/** أدوات المنتج من شاشة الدخول + عناصر التنقل المعرفة في النظام */
export function getTrialEvalTools(): TrialEvalTool[] {
  const login: TrialEvalTool = {
    tool: "تسجيل الدخول",
    path: "/login",
    verify: VERIFY_BY_PATH["/login"],
  };

  const fromNav = NAV_ITEMS.map((item) => ({
    tool: item.label,
    path: item.href,
    verify:
      VERIFY_BY_PATH[item.href] ??
      "فتح الشاشة والتأكد من ظهور المحتوى وتنفيذ الإجراء الأساسي الظاهر فيها",
  }));

  return [login, ...fromNav];
}

export function buildTrialEvalReport(
  rows: Array<TrialEvalTool & { rating: TrialEvalRating; note?: string }>,
): string {
  const header = ["الأداة", "المسار", "ما يُتحقق منه", "التقييم", "ملاحظة"].join("\t");
  const body = rows.map((r) =>
    [r.tool, r.path, r.verify, r.rating, r.note?.trim() || "—"].join("\t"),
  );
  const counts = TRIAL_EVAL_RATINGS.map(
    (label) => `${label}: ${rows.filter((r) => r.rating === label).length}`,
  ).join(" | ");
  return [
    "تقرير تقييم أدوات منصة رداء",
    `التاريخ: ${new Date().toLocaleString("ar-SA")}`,
    counts,
    "",
    header,
    ...body,
  ].join("\n");
}
