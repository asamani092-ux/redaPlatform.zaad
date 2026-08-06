/**
 * مسارات القراءة المُصفَّحة (page/pageSize=50) عبر parsePageParams.
 * أي قائمة تشغيلية جديدة تُضاف هنا وتُربط بـ PaginationBar في الواجهة.
 */
export const LIST_PATHS = [
  { id: "audit.list", route: "GET /api/audit", pageSize: 50 },
  { id: "beneficiaries.list", route: "GET /api/beneficiaries", pageSize: 50 },
  { id: "invites.list", route: "GET /api/invites", pageSize: 50 },
  { id: "survey.responses", route: "GET /api/survey", pageSize: 50 },
  { id: "inventory.list", route: "GET /api/inventory", pageSize: 50 },
  { id: "users.list", route: "GET /api/users", pageSize: 50 },
  { id: "attendance.recent", route: "GET /api/attendance", pageSize: 50 },
  { id: "dispense.recent", route: "GET /api/dispense", pageSize: 50 },
  { id: "liveLinks.list", route: "GET /api/live-links", pageSize: 50 },
] as const;
