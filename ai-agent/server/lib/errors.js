export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// يلفّ معالجات async حتى تصل أخطاؤها لمعالج الأخطاء الموحّد
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
