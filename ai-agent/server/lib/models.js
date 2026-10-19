// الموديلات المتاحة وأسعارها (دولار لكل مليون توكن) لحساب الاستهلاك والحدود.
// الأسعار من قائمة Anthropic الرسمية (أكتوبر 2026).
export const MODELS = {
  "claude-opus-5-5": {
    label: "Claude Opus 5.5",
    hint: "الأذكى — للتحليل والاستشارات المعقّدة",
    in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2,
    fallbacks: true,
    webSearch: "web_search_20260209",
  },
  "claude-sonnet-5-5": {
    label: "Claude Sonnet 5.5",
    hint: "متوازن — سريع وذكي وأرخص بالنصف",
    in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2,
    fallbacks: true,
    webSearch: "web_search_20260209",
  },
  "claude-haiku-5-5": {
    label: "Claude Haiku 5.5",
    hint: "الأسرع والأرخص — للمهام اليومية البسيطة",
    in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01,
    // فوق 100 ألف توكن مدخلات يرتفع السعر
    longThreshold: 100_000, longIn: 0.5, longOut: 2.5,
    fallbacks: false, // لا يدعم fallbacks من جهة السيرفر
    webSearch: "web_search_20250305",
  },
};

export const DEFAULT_MODEL = "claude-opus-5-5";
export const WEB_SEARCH_USD = 0.01; // 10$ لكل 1000 بحث

export const modelInfo = (id) => MODELS[id] || MODELS[DEFAULT_MODEL];

function costOfOne(model, u) {
  const m = modelInfo(model);
  const input = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  const long = m.longThreshold && input > m.longThreshold;
  const rIn = long ? m.longIn : m.in;
  const rOut = long ? m.longOut : m.out;
  const scale = rIn / m.in;
  return (
    ((u.input_tokens || 0) * rIn +
      (u.output_tokens || 0) * rOut +
      (u.cache_creation_input_tokens || 0) * m.cacheWrite * scale +
      (u.cache_read_input_tokens || 0) * m.cacheRead * scale) / 1e6
  );
}

// usage.iterations (عند الـfallback أو التلخيص) هو المرجع لكل محاولة؛ وإلا الإجمالي.
export function costOfUsage(model, usage) {
  if (!usage) return { usd: 0, inTok: 0, outTok: 0 };
  const iters = Array.isArray(usage.iterations) && usage.iterations.length ? usage.iterations : [usage];
  let usd = 0, inTok = 0, outTok = 0;
  for (const it of iters) {
    usd += costOfOne(it.model || model, it);
    inTok += (it.input_tokens || 0) + (it.cache_read_input_tokens || 0) + (it.cache_creation_input_tokens || 0);
    outTok += it.output_tokens || 0;
  }
  usd += (usage.server_tool_use?.web_search_requests || 0) * WEB_SEARCH_USD;
  return { usd, inTok, outTok };
}
