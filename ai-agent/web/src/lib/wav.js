// تسجيل الميكروفون إلى WAV (PCM 16kHz mono) للتعرّف السحابي على الكلام،
// مع كشف السكوت لإنهاء التسجيل تلقائيًا في وضع المكالمة.
export async function recordWav({ maxMs = 30000, silenceMs = 1300, onLevel, signal } = {}) {
  const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaStreamSource(media);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  let heardVoice = false;
  let lastVoice = performance.now();
  const started = performance.now();

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      proc.disconnect();
      src.disconnect();
      media.getTracks().forEach((t) => t.stop());
      const rate = ctx.sampleRate;
      ctx.close();
      resolve(heardVoice ? encodeWav(chunks, rate) : null);
    };
    signal?.addEventListener("abort", finish);
    proc.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      onLevel?.(rms);
      const now = performance.now();
      if (rms > 0.02) { heardVoice = true; lastVoice = now; }
      if ((heardVoice && now - lastVoice > silenceMs) || now - started > maxMs) finish();
      if (!heardVoice && now - started > 8000) finish(); // لم يتكلم أحد
    };
    src.connect(proc);
    proc.connect(ctx.destination);
  });
}

function encodeWav(chunks, inRate) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  // تحويل التردد إلى 16kHz
  const outRate = 16000;
  const ratio = inRate / outRate;
  const outLen = Math.floor(all.length / ratio);
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}
