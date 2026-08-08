// حارس جسر Odoo — يتحقّق من المفتاح المشترك (Bearer token) قبل أي إجراء تكامل
import { config } from "../config.js";
import { unauthorized, forbidden } from "../lib/errors.js";

export function requireIntegrationToken(req, res, next) {
  if (!config.integrationToken) return next(forbidden("جسر التكامل غير مُفعّل (INTEGRATION_TOKEN غير مضبوط)"));
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (!token || token !== config.integrationToken) return next(unauthorized("مفتاح تكامل غير صالح"));
  next();
}
