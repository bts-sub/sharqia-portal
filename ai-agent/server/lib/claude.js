// عميل Claude المشترك (المفتاح من إعدادات الإدارة، ويُعاد إنشاؤه إن تغيّر)
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicKey } from "./settings.js";
import { AppError } from "./errors.js";

let cached = { key: null, client: null };
export function getClient() {
  const key = getAnthropicKey();
  if (!key) throw new AppError("لم تُضِف الإدارة مفتاح Claude بعد — من صفحة الإدارة ← الإعدادات", 503);
  if (cached.key !== key) cached = { key, client: new Anthropic({ apiKey: key, maxRetries: 2 }) };
  return cached.client;
}
