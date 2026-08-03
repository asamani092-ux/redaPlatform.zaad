/**
 * سجل مسارات الكتابة الخاضعة للتدقيق.
 * أي مسار كتابة جديد يجب إضافته هنا وربطه بـ writeAuditLog.
 */
export type WritePathSpec = {
  id: string;
  entityType: string;
  action: string;
  route: string;
  audited: boolean;
  /** إن لم يُدقَّق: سبب الاستثناء المعتمد */
  excludeReason?: string;
};

export const WRITE_PATHS: WritePathSpec[] = [
  { id: "beneficiary.create", entityType: "Beneficiary", action: "CREATE", route: "POST /api/beneficiaries", audited: true },
  { id: "beneficiary.update", entityType: "Beneficiary", action: "UPDATE", route: "PATCH /api/beneficiaries/[id]", audited: true },
  { id: "beneficiary.import", entityType: "Beneficiary", action: "IMPORT", route: "POST /api/beneficiaries/import", audited: true },
  { id: "invite.create", entityType: "ExhibitionInvite", action: "INVITE", route: "POST /api/invites", audited: true },
  { id: "attendance.create", entityType: "Attendance", action: "CHECKIN|CHECKIN_EXCEPTION", route: "POST /api/attendance", audited: true },
  { id: "dispense.create", entityType: "DispenseOrder", action: "DISPENSE", route: "POST /api/dispense", audited: true },
  { id: "dispense.override", entityType: "DispenseOrder", action: "ENTITLEMENT_OVERRIDE", route: "POST /api/dispense", audited: true },
  { id: "inventory.create", entityType: "InventoryItem", action: "INVENTORY_CREATE", route: "POST /api/inventory", audited: true },
  { id: "inventory.update", entityType: "InventoryItem", action: "INVENTORY_UPDATE", route: "PUT /api/inventory", audited: true },
  { id: "inventory.stock", entityType: "InventoryItem", action: "STOCK_ADD|STOCK_RETURN", route: "PATCH /api/inventory", audited: true },
  { id: "exhibition.create", entityType: "Exhibition", action: "EXHIBITION_CREATE", route: "POST /api/exhibitions", audited: true },
  { id: "exhibition.activate", entityType: "Exhibition", action: "EXHIBITION_ACTIVATE", route: "POST /api/exhibitions/[id]/activate", audited: true },
  { id: "settings.update", entityType: "ExhibitionSettings", action: "UPDATE_SETTINGS", route: "PUT /api/settings", audited: true },
  { id: "association.upsert", entityType: "AssociationOption", action: "ASSOCIATION_UPSERT", route: "POST|PATCH /api/associations", audited: true },
  { id: "user.create", entityType: "User", action: "USER_CREATE", route: "POST /api/users", audited: true },
  { id: "user.update", entityType: "User", action: "USER_UPDATE", route: "PATCH /api/users", audited: true },
  { id: "survey.create", entityType: "SurveyResponse", action: "SURVEY", route: "POST /api/survey", audited: true },
  { id: "survey.broadcast", entityType: "SurveyResponse", action: "SURVEY_BROADCAST", route: "POST /api/survey/broadcast", audited: true },
  { id: "invites.qrCards", entityType: "ExhibitionInvite", action: "QR_CARDS_EXPORT", route: "GET /api/invites/qr-cards", audited: true },
  { id: "beneficiary.delete", entityType: "Beneficiary", action: "DELETE", route: "DELETE /api/beneficiaries/[id]", audited: true },
  { id: "user.delete", entityType: "User", action: "USER_DELETE|USER_DEACTIVATE", route: "DELETE /api/users", audited: true },
  { id: "password.reset", entityType: "User", action: "PASSWORD_RESET", route: "POST /api/password/reset", audited: true },
  { id: "whatsapp.settings", entityType: "AppConfig", action: "WHATSAPP_SETTINGS_UPDATE", route: "PUT /api/settings/whatsapp", audited: true },
  { id: "whatsapp.test", entityType: "AppConfig", action: "WHATSAPP_TEST", route: "POST /api/settings/whatsapp/test", audited: true },
  {
    id: "password.forgot",
    entityType: "PasswordReset",
    action: "OTP_ISSUE",
    route: "POST /api/password/forgot",
    audited: false,
    excludeReason: "إصدار رمز تحقق قبل التوثيق — الرسالة مسجلة في OutboundMessage والتغيير الفعلي مدقق في PASSWORD_RESET",
  },
  {
    id: "auth.session",
    entityType: "User",
    action: "LAST_ACTIVE",
    route: "NextAuth session touch",
    audited: false,
    excludeReason: "تحديث نشاط الجلسة دوري عالي التردد — ليس عملية أعمال؛ يُستثنى عمداً لتجنب إغراق سجل التدقيق",
  },
  {
    id: "outbound.stub",
    entityType: "OutboundMessage",
    action: "MESSAGE_STUB",
    route: "sendWhatsAppMessage",
    audited: false,
    excludeReason: "أثر جانبي لدعوة/صرف/استبيان المُدقَّقة أصلاً؛ السجل في OutboundMessage كافٍ",
  },
];

export function auditedWritePaths(): WritePathSpec[] {
  return WRITE_PATHS.filter((p) => p.audited);
}
