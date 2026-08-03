/** تعريب حركات سجل العمليات وأنواع الكيانات — بحث O(1) */
export const ACTION_LABELS: Record<string, string> = {
  CREATE: "إضافة",
  UPDATE: "تعديل",
  DELETE: "حذف",
  IMPORT: "استيراد",
  INVITE: "دعوة",
  BULK_INVITE: "دعوة جماعية",
  CHECKIN: "تسجيل حضور",
  CHECKIN_EXCEPTION: "حضور استثنائي",
  DISPENSE: "صرف قطع",
  ENTITLEMENT_OVERRIDE: "تعديل استحقاق",
  INVENTORY_CREATE: "إضافة صنف",
  INVENTORY_UPDATE: "تعديل صنف",
  STOCK_ADD: "إضافة كمية",
  STOCK_RETURN: "استرجاع كمية",
  EXHIBITION_CREATE: "إنشاء معرض",
  EXHIBITION_ACTIVATE: "تفعيل معرض",
  UPDATE_SETTINGS: "تحديث الإعدادات",
  ASSOCIATION_UPSERT: "تحديث جمعية",
  USER_CREATE: "إنشاء مستخدم",
  USER_UPDATE: "تعديل مستخدم",
  USER_DELETE: "حذف مستخدم",
  USER_DEACTIVATE: "إيقاف مستخدم",
  SURVEY: "استبيان",
  SURVEY_SUBMIT: "تسجيل استبيان",
  SURVEY_BROADCAST: "إرسال استبيان جماعي",
  QR_CARDS_EXPORT: "طباعة بطاقات QR",
  PASSWORD_RESET: "استعادة كلمة مرور",
  WHATSAPP_SETTINGS_UPDATE: "تحديث إعداد واتساب",
  WHATSAPP_TEST: "اختبار إرسال واتساب",
};

export const ENTITY_LABELS: Record<string, string> = {
  Beneficiary: "مستفيد",
  User: "مستخدم",
  ExhibitionInvite: "دعوة",
  Attendance: "حضور",
  DispenseOrder: "أمر صرف",
  InventoryItem: "صنف مخزون",
  StockMovement: "حركة مخزون",
  Exhibition: "معرض",
  ExhibitionSettings: "إعدادات معرض",
  AssociationOption: "جمعية",
  SurveyResponse: "رد استبيان",
  OutboundMessage: "رسالة صادرة",
  AppConfig: "إعدادات المنصة",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}
