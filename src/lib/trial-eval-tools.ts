import { NAV_ITEMS } from "@/lib/rbac";

/** تقييمات ثابتة لقائمة قبول التجربة */
export const TRIAL_EVAL_RATINGS = ["غير مجرّب", "يعتمد", "يحتاج تحسين"] as const;
export type TrialEvalRating = (typeof TRIAL_EVAL_RATINGS)[number];

export type TrialEvalTool = {
  /** مفتاح ثابت للتخزين المحلي — لا يُعاد استخدامه لمسارين */
  id: string;
  tool: string;
  path: string;
  verify: string;
};

/**
 * ما يُتحقق منه لكل أداة/مسار ظاهر في المنتج.
 * زمن البناء O(n)، مساحة O(n).
 */
const VERIFY_BY_PATH: Record<string, string> = {
  "/login":
    "الدخول بالجوال وكلمة المرور؛ نسيت كلمة المرور تفتح تعديل كلمة المرور بعد الجوال؛ رفض البيانات الخاطئة",
  "/forgot-password":
    "إدخال الجوال؛ استلام/تسجيل رسالة واتساب؛ تعيين كلمة مرور جديدة والدخول بها",
  "/dashboard":
    "ظهور مؤشرات المعرض النشط؛ عرض الأصناف الأكثر صرفاً بتسميات عربية كاملة دون اختصار",
  "/beneficiaries":
    "بحث؛ إضافة؛ تحميل نموذج Excel ثم تعبئته ورفعه؛ إخفاء الإضافة عن الاستقبال",
  "/invites":
    "دعوة وإرسال QR واتساب؛ حالة التسليم وإعادة الإرسال؛ طباعة قائمة المدعوين بهوية المنصة مع الباركود",
  "/attendance":
    "المسح بالكاميرا أو البحث؛ بطاقة معاينة؛ منع التكرار؛ استثناء بسبب؛ رفض رمز غير تابع للمعرض",
  "/dispense":
    "يشترط الحضور؛ كميات ضمن الاستحقاق؛ حقل الإضافة فوق الاستحقاق؛ إعادة الصرف بسبب؛ إرسال الاستبيان افتراضياً",
  "/inventory":
    "إضافة وتعديل أصناف؛ حركة إضافة أو حذف كمية مع سبب إلزامي للحذف؛ تنبيه النفاد",
  "/reports":
    "عرض الملخص حسب المعرض؛ تصدير جداول وملف للطباعة؛ للمدير اختيار معرض دون تبديل النشط",
  "/survey":
    "إعداد الأسئلة؛ خيار الإرسال التلقائي بعد الصرف؛ متابعة الردود؛ إعادة إرسال واتساب؛ لا إدخال يدوي",
  "/exhibitions":
    "إنشاء بمعرض فريد؛ حالات قادم/جاري/منتهٍ/نشط؛ تفعيل معرض تشغيلي واحد",
  "/settings":
    "أقسام في نوافذ عائمة؛ سمات مخزون بتسمية عربية ومفتاح مخفي؛ قوالب وربط واتساب",
  "/users":
    "إضافة وتعديل وحذف وتغيير كلمة المرور؛ منع تكرار الجوال",
  "/audit":
    "عرض سجل العمليات الأخيرة مع المستخدم والكيان والوقت وحالة النجاح/الفشل",
  "/messages":
    "نافذة عائمة؛ تبويب دعوة/استبيان؛ حالة الإرسال؛ تصحيح الجوال؛ إعادة الإرسال؛ تأكيد استبيان بلا صرف",
  "/trial-eval":
    "فتح قائمة التقييم كمدير؛ حفظ التقييمات محلياً؛ نسخ التقرير",
};

/** أدوات إضافية (إجراءات داخل الشاشات / مسارات مساعدة) — تُضاف تراكمياً للقائمة */
const EXTRA_TOOLS: TrialEvalTool[] = [
  {
    id: "forgot-password",
    tool: "نسيت كلمة المرور",
    path: "/forgot-password",
    verify: VERIFY_BY_PATH["/forgot-password"],
  },
  {
    id: "beneficiaries-import",
    tool: "استيراد المستفيدين (Excel)",
    path: "/beneficiaries#import",
    verify:
      "تحميل النموذج؛ رفع ملف صالح؛ ظهور أخطاء الصفوف بوضوح؛ عدم حذف الأصفار في الهوية/الجوال",
  },
  {
    id: "invites-whatsapp",
    tool: "إرسال دعوة واتساب + QR",
    path: "/invites#whatsapp",
    verify: "إرسال الدعوة؛ ظهور حالة SENT/STUBBED/FAILED؛ إعادة الإرسال عند الفشل",
  },
  {
    id: "invites-print",
    tool: "طباعة قائمة المدعوين",
    path: "/invites#print",
    verify: "طباعة بهوية المنصة مع الباركود للمدعوين فقط",
  },
  {
    id: "attendance-camera",
    tool: "مسح حضور بالكاميرا",
    path: "/attendance#camera",
    verify: "تشغيل الكاميرا؛ قراءة QR؛ تسجيل الحضور أو رفض الرمز الخاطئ",
  },
  {
    id: "attendance-exception",
    tool: "حضور استثنائي",
    path: "/attendance#exception",
    verify: "تسجيل حضور استثنائي مع سبب؛ يظهر في التقارير كاستثناء",
  },
  {
    id: "dispense-extra",
    tool: "صرف مع إضافة فوق الاستحقاق",
    path: "/dispense#extra",
    verify: "الإضافة فوق المحسوب وليست بديلاً عنه؛ سبب إلزامي؛ صلاحية الاستثناء",
  },
  {
    id: "dispense-repeat",
    tool: "إعادة صرف (تراكمي)",
    path: "/dispense#repeat",
    verify: "السماح بصرف لاحق مع سبب؛ حفظ التاريخ السابق؛ تحديث إجمالي القطع",
  },
  {
    id: "dispense-survey",
    tool: "إرسال استبيان بعد الصرف",
    path: "/dispense#survey",
    verify:
      "تفعيل الإرسال التلقائي من إعداد الاستبيان؛ ظهوره محدّداً في الصرف؛ رسالة واتساب بعد الاستلام",
  },
  {
    id: "inventory-stock-move",
    tool: "حركة مخزون (إضافة/حذف كمية)",
    path: "/inventory#stock",
    verify: "إضافة كمية؛ حذف بكمية وسبب؛ تحديث الرصيد وتنبيه النفاد",
  },
  {
    id: "reports-excel",
    tool: "تصدير Excel",
    path: "/reports#excel",
    verify: "تنزيل ملف xlsx للملخص والتفاصيل؛ أعمدة الهوية حسب صلاحية المدير",
  },
  {
    id: "reports-pdf",
    tool: "تصدير PDF / طباعة",
    path: "/reports#pdf",
    verify: "فتح ملف قابل للطباعة بهوية المنصة",
  },
  {
    id: "reports-presentation",
    tool: "منشئ العرض التقديمي",
    path: "/reports#presentation",
    verify:
      "فتح المنشئ بجانب Excel؛ الشرائح من مؤشرات المعرض (KPI/قمع/توزيع/أصناف)؛ بدء العرض ملء الشاشة",
  },
  {
    id: "reports-live-links",
    tool: "روابط العرض الحي للشاشات",
    path: "/reports#live",
    verify: "إنشاء رابط بلا تسجيل دخول؛ نسخ الرابط؛ الحذف يوقف العرض فوراً",
  },
  {
    id: "live-public",
    tool: "شاشة العرض الحي (عامة)",
    path: "/live",
    verify: "فتح الرابط العام؛ تحديث المؤشرات؛ رفض/إيقاف بعد حذف الرابط",
  },
  {
    id: "survey-questions",
    tool: "إعداد أسئلة الاستبيان",
    path: "/survey#questions",
    verify:
      "إضافة/إزالة أسئلة؛ رابط خارجي اختياري؛ تفعيل/إيقاف الإرسال التلقائي عند استلام القطع؛ حفظ",
  },
  {
    id: "survey-responses",
    tool: "ردود الاستبيان + طباعة",
    path: "/survey#responses",
    verify: "ظهور الردود المحفوظة؛ طباعة الردود؛ لا تبويب إدخال يدوي للطاقم",
  },
  {
    id: "survey-broadcast",
    tool: "إعادة إرسال الاستبيان جماعياً",
    path: "/survey#broadcast",
    verify: "إرسال لمن استلم / لكل الحضور؛ بدون تكرار للمستفيد عند تعدد الصرف",
  },
  {
    id: "settings-whatsapp",
    tool: "إعدادات واتساب",
    path: "/settings#whatsapp",
    verify: "تبديل stub/api؛ حفظ الرابط والتوكن؛ رسالة اختبار",
  },
  {
    id: "settings-inventory-schema",
    tool: "سمات المخزون",
    path: "/settings#inventory-schema",
    verify: "تسمية عربية ظاهرة؛ مفتاح تقني مخفي؛ خيارات متعددة الأسطر",
  },
  {
    id: "settings-entitlement",
    tool: "الاستحقاق (أساسي + تابعون)",
    path: "/settings#entitlement",
    verify: "ضبط الأساسي ووحدة التابع؛ انعكاس الحساب في الصرف والمعاينة",
  },
  {
    id: "favicon",
    tool: "أيقونة تبويب الموقع (favicon)",
    path: "/#favicon",
    verify: "ظهور أيقونة رداء/الزاد في تبويب المتصفح وليس أيقونة Next الافتراضية",
  },
  {
    id: "messages-log",
    tool: "سجل رسائل واتساب",
    path: "/messages",
    verify:
      "فتح النافذة؛ فلترة فشل الجوال/الدعوة/الاستبيان؛ حفظ جوال؛ إعادة دعوة؛ إعادة استبيان مع تأكيد إن لم يصرف",
  },
  {
    id: "trial-eval-page",
    tool: "صفحة تقييم التجربة",
    path: "/trial-eval",
    verify: VERIFY_BY_PATH["/trial-eval"],
  },
];

/** أدوات المنتج: دخول + تنقل + إجراءات التشغيل الجديدة */
export function getTrialEvalTools(): TrialEvalTool[] {
  const login: TrialEvalTool = {
    id: "login",
    tool: "تسجيل الدخول",
    path: "/login",
    verify: VERIFY_BY_PATH["/login"],
  };

  const fromNav: TrialEvalTool[] = NAV_ITEMS.map((item) => ({
    id: `nav-${item.href.replace(/^\//, "")}`,
    tool: item.label,
    path: item.href,
    verify:
      VERIFY_BY_PATH[item.href] ??
      "فتح الشاشة والتأكد من ظهور المحتوى وتنفيذ الإجراء الأساسي الظاهر فيها",
  }));

  const byId = new Map<string, TrialEvalTool>();
  for (const t of [login, ...fromNav, ...EXTRA_TOOLS]) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return Array.from(byId.values());
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
