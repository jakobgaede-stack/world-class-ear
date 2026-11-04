// Mikrofon und Tonhöhenerkennung (YIN) für das Blattsingen.
import { getCtx } from './context.js';

let stream = null;
let source = null;
let analyser = null;
let timer = null;
let buf = null;

/** YIN-Tonhöhenerkennung: gibt Frequenz (Hz) und Klarheit (0..1) zurück, oder null. */
export function yin(frame, sampleRate, { threshold = 0.15, minHz = 60, maxHz = 1000 } = {}) {
  const n = frame.length;
  const maxTau = Math.min(Math.floor(sampleRate / minHz), Math.floor(n / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  // Lautstärke-Schwelle
  let rms = 0;
  for (let i = 0; i < n; i++) rms += frame[i] * frame[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < n - maxTau; i++) {
      const delta = frame[i] - frame[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }
  // kumulative mittlere normierte Differenz
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }
  let tauEst = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) {
    // bestes Minimum als Notlösung, nur wenn deutlich
    let best = minTau;
    for (let tau = minTau; tau <= maxTau; tau++) if (cmnd[tau] < cmnd[best]) best = tau;
    if (cmnd[best] > 0.35) return null;
    tauEst = best;
  }
  // parabolische Interpolation
  let better = tauEst;
  if (tauEst > 1 && tauEst < maxTau) {
    const s0 = cmnd[tauEst - 1];
    const s1 = cmnd[tauEst];
    const s2 = cmnd[tauEst + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tauEst + (s2 - s0) / denom;
  }
  return { hz: sampleRate / better, clarity: 1 - cmnd[tauEst], rms };
}

export function hzToMidi(hz) {
  return 69 + 12 * Math.log2(hz / 440);
}

/**
 * Mikrofon starten; onFrame({t, midi, hz, clarity, rms}) etwa 40-mal je Sekunde (midi = null bei Stille).
 */
export async function startMic(onFrame) {
  const ctx = getCtx();
  if (ctx.state !== 'running') await ctx.resume();
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
  source = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  buf = new Float32Array(analyser.fftSize);
  const t0 = performance.now();
  timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const r = yin(buf, ctx.sampleRate);
    onFrame({ t: (performance.now() - t0) / 1000, midi: r ? hzToMidi(r.hz) : null, hz: r ? r.hz : null, clarity: r ? r.clarity : 0, rms: r ? r.rms : 0 });
  }, 25);
  return { stop: stopMic };
}

export function stopMic() {
  clearInterval(timer);
  timer = null;
  try { source && source.disconnect(); } catch (e) {}
  if (stream) for (const tr of stream.getTracks()) tr.stop();
  stream = null;
  source = null;
}

/**
 * Tonhöhenspur in gesungene Noten zerlegen.
 * frames: [{t, midi|null, clarity}] → [{midi (gerundet), cents (Abweichung vom gerundeten Ton), start, end}]
 */
export function segmentNotes(frames, { minDur = 0.12, tolerance = 0.6 } = {}) {
  // Medianfilter über 5 Frames gegen Ausreißer
  const vals = frames.map((f) => (f.midi !== null && f.clarity > 0.5 ? f.midi : null));
  const smooth = vals.map((v, i) => {
    if (v === null) return null;
    const w = [];
    for (let k = i - 2; k <= i + 2; k++) if (vals[k] !== null && vals[k] !== undefined) w.push(vals[k]);
    w.sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });
  const notes = [];
  let cur = null;
  for (let i = 0; i < smooth.length; i++) {
    const v = smooth[i];
    const t = frames[i].t;
    if (v === null) {
      if (cur) { cur.end = t; if (cur.end - cur.start >= minDur) notes.push(finish(cur)); cur = null; }
      continue;
    }
    if (cur && Math.abs(v - cur.ref) <= tolerance) {
      cur.vals.push(v);
      cur.end = t;
    } else {
      if (cur) { cur.end = t; if (cur.end - cur.start >= minDur) notes.push(finish(cur)); }
      cur = { ref: v, vals: [v], start: t, end: t };
    }
  }
  if (cur && cur.end - cur.start >= minDur) notes.push(finish(cur));
  // Benachbarte Noten gleicher Höhe zusammenführen, wenn Lücke sehr kurz
  const merged = [];
  for (const n of notes) {
    const last = merged[merged.length - 1];
    if (last && last.midi === n.midi && n.start - last.end < 0.08) { last.end = n.end; continue; }
    merged.push(n);
  }
  return merged;
  function finish(c) {
    const sorted = c.vals.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const midi = Math.round(median);
    return { midi, cents: Math.round((median - midi) * 100), start: c.start, end: c.end };
  }
}
