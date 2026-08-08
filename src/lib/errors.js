// أخطاء موحّدة — الواجهة تتوقّع { error: "..." } مع كود حالة مناسب
export class AppError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const badRequest = (m = "طلب غير صالح") => new AppError(m, 400, "BAD_REQUEST");
export const unauthorized = (m = "الجلسة غير صالحة") => new AppError(m, 401, "UNAUTHORIZED");
export const forbidden = (m = "لا تملك الصلاحية") => new AppError(m, 403, "FORBIDDEN");
export const notFound = (m = "غير موجود") => new AppError(m, 404, "NOT_FOUND");
export const upstream = (m = "تعذّر الاتصال بالخادم الخلفي") => new AppError(m, 502, "UPSTREAM");
