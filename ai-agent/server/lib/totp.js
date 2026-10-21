// التحقق بخطوتين (TOTP — RFC 6238): رمز من 6 أرقام يتغيّر كل 30 ثانية
// في تطبيق مثل Google Authenticator أو Microsoft Authenticator.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ISSUER = "Sharqia-AI";

export function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

function codeAt(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(off) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

// يرجع رقم الخطوة المقبولة (لمنع إعادة استخدام نفس الرمز) أو null
export function verifyTotp(secret, code, lastStep = 0) {
  const c = String(code || "").replace(/\D/g, "");
  if (c.length !== 6) return null;
  const now = Math.floor(Date.now() / 30_000);
  for (const d of [0, -1, 1]) {
    const step = now + d;
    if (step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUrl(secret, account) {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=30`;
}

// رموز الاسترداد: تُعرض مرة واحدة، ويُحفظ هاشها فقط
const hashCode = (c) => createHash("sha256").update(String(c).toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");

export function newRecoveryCodes(n = 8) {
  const codes = Array.from({ length: n }, () => {
    const s = base32Encode(randomBytes(5)).toLowerCase().slice(0, 8);
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  return { codes, hashes: codes.map(hashCode) };
}

export function matchRecoveryCode(hashes = [], code) {
  const h = hashCode(code);
  return hashes.findIndex((x) => timingSafeEqual(Buffer.from(x), Buffer.from(h)));
}
