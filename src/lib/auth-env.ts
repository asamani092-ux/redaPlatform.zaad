/**
 * يصحّح بيئة المصادقة خلف وكيل عكسي.
 * إن وُجد عنوان محلي في الإنتاج مع تفعيل الوثوق بالمضيف — يُحذف ليعتمد الطلب الفعلي.
 * Time/Space: O(1).
 */
export function sanitizeAuthEnv(): void {
  if (process.env.AUTH_TRUST_HOST !== "true") return;
  if (process.env.NODE_ENV !== "production") return;

  for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    try {
      const host = new URL(value).hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        delete process.env[key];
      }
    } catch {
      /* تجاهل قيمة غير صالحة */
    }
  }
}
