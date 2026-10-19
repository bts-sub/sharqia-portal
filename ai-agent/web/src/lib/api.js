// طبقة الاتصال بالسيرفر. كل طلب يغيّر بيانات يحمل ترويسة X-App (حماية CSRF).
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const HEADERS = { "X-App": "sq-ai" };

async function handle(res) {
  if (res.ok) {
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res;
  }
  let msg = "تعذّر الاتصال بالسيرفر";
  try { msg = (await res.json()).error || msg; } catch {}
  if (res.status === 401) window.dispatchEvent(new Event("sq-auth-expired"));
  throw new ApiError(msg, res.status);
}

export async function api(path, { method = "GET", body, raw, headers = {}, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...HEADERS,
        ...(body !== undefined && !raw ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("لا يوجد اتصال بالإنترنت أو السيرفر لا يستجيب", 0);
  }
  return handle(res);
}

// طلب بثّ SSE: onEvent(event, data) لكل حدث.
export async function stream(path, body, onEvent, { signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { ...HEADERS, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body ?? {}),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") return;
    throw new ApiError("انقطع الاتصال بالسيرفر", 0);
  }
  if (!res.ok) await handle(res);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;
      try { onEvent(event, JSON.parse(data)); } catch (e) { console.warn("sse", e); }
    }
  }
}

export const fmtUsd = (n) => `$${(n || 0).toFixed(n >= 100 ? 0 : 2)}`;
export const fmtBytes = (b) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b || 0} B`;
export const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
};
