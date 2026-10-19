// إعدادات المنظّمة: مفتاح Claude ومفتاح Azure Speech (مشفّران)، والافتراضيات.
import { settingsStore } from "./store.js";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { DEFAULT_MODEL, MODELS } from "./models.js";

const EFFORTS = ["low", "medium", "high"];

export function getSettings() {
  const s = settingsStore.get();
  return {
    orgName: s.orgName || "بيت العباءة الشرقية",
    defaultModel: MODELS[s.defaultModel] ? s.defaultModel : DEFAULT_MODEL,
    effort: EFFORTS.includes(s.effort) ? s.effort : "medium",
    azureRegion: s.azureRegion || "",
    hasAnthropicKey: Boolean(s.anthropicKey || process.env.ANTHROPIC_API_KEY),
    anthropicKeyHint: s.anthropicKeyHint || (process.env.ANTHROPIC_API_KEY ? "من ملف البيئة" : ""),
    hasAzure: Boolean(s.azureKey && s.azureRegion),
    azureKeyHint: s.azureKeyHint || "",
  };
}

export function getAnthropicKey() {
  const s = settingsStore.get();
  return s.anthropicKey ? decryptSecret(s.anthropicKey) : (process.env.ANTHROPIC_API_KEY || "");
}

export function getAzure() {
  const s = settingsStore.get();
  if (!s.azureKey || !s.azureRegion) return null;
  return { key: decryptSecret(s.azureKey), region: s.azureRegion };
}

const hint = (k) => `…${k.slice(-4)}`;

export function updateSettings(patch) {
  settingsStore.update((s) => {
    if (typeof patch.orgName === "string" && patch.orgName.trim()) s.orgName = patch.orgName.trim().slice(0, 80);
    if (MODELS[patch.defaultModel]) s.defaultModel = patch.defaultModel;
    if (EFFORTS.includes(patch.effort)) s.effort = patch.effort;
    if (typeof patch.anthropicKey === "string") {
      const k = patch.anthropicKey.trim();
      s.anthropicKey = k ? encryptSecret(k) : undefined;
      s.anthropicKeyHint = k ? hint(k) : undefined;
    }
    if (typeof patch.azureKey === "string") {
      const k = patch.azureKey.trim();
      s.azureKey = k ? encryptSecret(k) : undefined;
      s.azureKeyHint = k ? hint(k) : undefined;
    }
    if (typeof patch.azureRegion === "string") s.azureRegion = patch.azureRegion.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  });
  return getSettings();
}
