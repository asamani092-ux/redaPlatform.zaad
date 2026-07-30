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
    "الدخول بالجوال وكلمة المرور، ورفض البيانات الخاطئة، والتوجيه بعد الدخول إلى أول شاشة مسموحة للدور",
  "/dashboard":
    "ظهور مؤشرات المعرض النشط (حضور، صرف، مخزون منخفض) وتحديثها دون أخطاء",
  "/beneficiaries":
    "البحث بالاسم أو الهوية أو الجوال؛ إضافة مستفيد من نافذة عائمة؛ الاستيراد لمن لديه صلاحية الإدارة؛ إخفاء أزرار الإضافة عن دور الاستقبال",
  "/invites":
    "تحديد مستفيدين ودعوتهم للمعرض النشط؛ توليد رمز داخلي لكل دعوة؛ إعادة التحميل بعد الدعوة",
  "/attendance":
    "المسح بالكاميرا أو لصق الرمز أو الهوية؛ بطاقة معاينة قبل التأكيد؛ منع التكرار؛ استثناء غير المدعو بسبب؛ رفض رمز لا يتبع المعرض النشط",
  "/dispense":
    "البحث أو المسح؛ رفض الصرف بلا حضور؛ اختيار الأصناف ضمن الاستحقاق؛ خصم المخزون؛ منع الصرف المكرر؛ تعطيل الزر أثناء الطلب",
  "/inventory":
    "إضافة صنف بنافذة وبسمات من قوائم منسدلة؛ حركة إضافة أو استرجاع؛ تنبيه قرب النفاد حسب العتبة",
  "/reports":
    "عرض الملخص حسب المعرض؛ تصدير جداول وملف للطباعة؛ للمدير اختيار معرض للعرض دون تبديل النشط التشغيلي",
  "/survey":
    "تسجيل إجابات الاستبيان المرتبطة بالمعرض النشط وظهور رسالة نجاح أو خطأ واضحة",
  "/exhibitions":
    "إنشاء معرض باسم فريد؛ تفعيل معرض واحد فقط؛ تحديث شارة المعرض النشط فوراً",
  "/settings":
    "عنوان إعدادات المعرض النشط؛ حفظ الاستحقاق وعتبة النفاد؛ إدارة خيارات سمات المخزون سطراً بسطر؛ قوائم الجمعيات وقوالب الرسائل",
  "/users":
    "إضافة مستخدم بنافذة عائمة مع دور؛ ظهور الحساب في القائمة؛ منع تكرار الجوال",
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
