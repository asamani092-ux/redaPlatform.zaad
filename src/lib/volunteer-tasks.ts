/** مهام المتطوع الافتراضية — تُزرع في قاعدة البيانات ويمكن توسيعها من الإعدادات */
export const DEFAULT_VOLUNTEER_TASKS = [
  "التواصل مع الجهات",
  "فرز الملابس",
  "ترتيب المعرض",
  "تنظيم الأسر",
  "استقبال الأسر",
  "حصر الأسر",
  "مساعدة الأسر",
  "الضيافة",
] as const;

export type VolunteerTaskName = (typeof DEFAULT_VOLUNTEER_TASKS)[number];
