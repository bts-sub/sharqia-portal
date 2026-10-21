// إعدادات المنظّمة: مفاتيح Claude وElevenLabs وAzure (مشفّرة)، والافتراضيات.
import { settingsStore } from "./store.js";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { DEFAULT_MODEL, MODELS } from "./models.js";

const EFFORTS = ["low", "medium", "high"];
export const ELEVEN_MODELS = {
  eleven_flash_v2_5: "سريع جدًا (موصى به للمحادثة الصوتية)",
  eleven_multilingual_v2: "أعلى ثباتًا للنصوص الطويلة",
};

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
    hasEleven: Boolean(s.elevenKey),
    elevenKeyHint: s.elevenKeyHint || "",
    elevenModel: ELEVEN_MODELS[s.elevenModel] ? s.elevenModel : "eleven_flash_v2_5",
    elevenVoiceMale: s.elevenVoiceMale || "",
    elevenVoiceFemale: s.elevenVoiceFemale || "",
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

export function getEleven() {
  const s = settingsStore.get();
  if (!s.elevenKey) return null;
  const pub = getSettings();
  return { key: decryptSecret(s.elevenKey), model: pub.elevenModel, male: pub.elevenVoiceMale, female: pub.elevenVoiceFemale };
}

const hint = (k) => `…${k.slice(-4)}`;
const voiceId = (v) => String(v || "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 40);

export function updateSettings(patch) {
  settingsStore.update((s) => {
    if (typeof patch.orgName === "string" && patch.orgName.trim()) s.orgName = patch.orgName.trim().slice(0, 80);
    if (MODELS[patch.defaultModel]) s.defaultModel = patch.defaultModel;
    if (EFFORTS.includes(patch.effort)) s.effort = patch.effort;
    const secret = (field, hintField, value) => {
      const k = value.trim();
      s[field] = k ? encryptSecret(k) : undefined;
      s[hintField] = k ? hint(k) : undefined;
    };
    if (typeof patch.anthropicKey === "string") secret("anthropicKey", "anthropicKeyHint", patch.anthropicKey);
    if (typeof patch.azureKey === "string") secret("azureKey", "azureKeyHint", patch.azureKey);
    if (typeof patch.elevenKey === "string") secret("elevenKey", "elevenKeyHint", patch.elevenKey);
    if (typeof patch.azureRegion === "string") s.azureRegion = patch.azureRegion.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (ELEVEN_MODELS[patch.elevenModel]) s.elevenModel = patch.elevenModel;
    if (typeof patch.elevenVoiceMale === "string") s.elevenVoiceMale = voiceId(patch.elevenVoiceMale);
    if (typeof patch.elevenVoiceFemale === "string") s.elevenVoiceFemale = voiceId(patch.elevenVoiceFemale);
  });
  return getSettings();
}
