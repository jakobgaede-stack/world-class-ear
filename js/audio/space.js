// Räumlichkeit: Sitzordnung (Panorama und Tiefe je Instrument), Hall (synthetische Impulsantwort), Stereo / HRTF / Surround.
import { getCtx } from './context.js';
import { state } from '../engine/state.js';

// Panorama (-1 links … +1 rechts) und Tiefe (1 = vorn, 3 = hinten) nach üblicher Sitzordnung
export const SEATING = {
  violin: { pan: -0.55, depth: 1.0 },
  viola: { pan: 0.25, depth: 1.2 },
  cello: { pan: 0.5, depth: 1.3 },
  contrabass: { pan: 0.75, depth: 1.8 },
  strings_ens: { pan: 0, depth: 1.2 },
  harp: { pan: -0.6, depth: 1.6 },
  flute: { pan: -0.15, depth: 2.0 },
  oboe: { pan: 0.12, depth: 2.0 },
  clarinet: { pan: -0.25, depth: 2.2 },
  bassoon: { pan: 0.25, depth: 2.2 },
  horn: { pan: -0.45, depth: 2.6 },
  trumpet: { pan: 0.3, depth: 2.8 },
  trombone: { pan: 0.45, depth: 2.9 },
  tuba: { pan: 0.6, depth: 3.0 },
  timpani: { pan: -0.3, depth: 3.2 },
  piano: { pan: 0, depth: 1.0 },
  organ: { pan: 0, depth: 2.5 },
  choir: { pan: 0, depth: 2.4 },
  sine: { pan: 0, depth: 1.0 },
};

let reverb = null; // { convolver, input (GainNode) }

function makeImpulse(ctx, seconds = 2.4, decay = 0.55) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  const pre = Math.floor(rate * 0.018);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      const env = i < pre ? 0 : Math.exp(-(t - 0.018) / decay);
      // frühe Reflexionen: einige dichte Spitzen in den ersten 80 ms
      let early = 0;
      if (i >= pre && t < 0.1) early = (Math.random() < 0.004 ? 0.6 : 0) * Math.exp(-(t - 0.018) / 0.05);
      const n = (Math.random() * 2 - 1) * env * 0.35 + early * (Math.random() * 2 - 1);
      // mit der Zeit dumpfer (Tiefpass, dessen Koeffizient wächst)
      const a = Math.min(0.92, 0.3 + t * 0.35);
      lp = a * lp + (1 - a) * n;
      d[i] = lp;
    }
  }
  return buf;
}

export function getReverb() {
  const ctx = getCtx();
  if (!reverb) {
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx);
    convolver.normalize = true;
    const input = ctx.createGain();
    input.gain.value = 1;
    input.connect(convolver);
    reverb = { convolver, input };
  }
  return reverb;
}

export function spaceMode() {
  return state.settings.space || 'stereo';
}

export function reverbAmount() {
  const v = state.settings.reverb;
  return v === undefined ? 0.28 : v;
}

/**
 * Baut die Ausgangsnodes für einen Ton: direkt (gepannt) und Hallanteil.
 * @returns {{ input: AudioNode, connect(dest, reverbBus): void }}
 */
export function makeSpatial(ctx, inst, { pan: panOverride = null, voiceIndex = 0, voices = 1 } = {}) {
  const seat = SEATING[inst] || { pan: 0, depth: 1.5 };
  let pan = panOverride !== null ? panOverride : seat.pan;
  // Tasteninstrumente und Chor: Stimmen leicht von links (tief) nach rechts (hoch) verteilen
  if (panOverride === null && (inst === 'piano' || inst === 'organ' || inst === 'choir') && voices > 1) pan = -0.35 + (0.7 * voiceIndex) / (voices - 1);
  const mode = spaceMode();
  const depth = seat.depth;
  const input = ctx.createGain();
  input.gain.value = 1;
  let direct;
  if (mode === 'mono') {
    direct = input;
  } else if (mode === 'hrtf') {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1;
    p.rolloffFactor = 0.6;
    const angle = pan * 0.9; // Radiant, Bühne vor dem Hörer
    const dist = 1.5 + depth;
    p.positionX.value = Math.sin(angle) * dist;
    p.positionY.value = 0;
    p.positionZ.value = -Math.cos(angle) * dist;
    input.connect(p);
    direct = p;
  } else {
    const sp = ctx.createStereoPanner();
    sp.pan.value = pan;
    input.connect(sp);
    direct = sp;
  }
  // Tiefe: hintere Instrumente etwas leiser und mit mehr Hall
  const depthGain = ctx.createGain();
  depthGain.gain.value = 1 / (0.75 + depth * 0.25);
  direct.connect(depthGain);
  const send = ctx.createGain();
  send.gain.value = reverbAmount() * (0.6 + depth * 0.25);
  input.connect(send);
  return {
    input,
    connect(dryBus) {
      depthGain.connect(dryBus);
      if (reverbAmount() > 0.001) send.connect(getReverb().input);
    },
  };
}

/** Hall-Ausgang mit dem Master verbinden (einmalig). */
export function wireReverb(dryBus) {
  const r = getReverb();
  try { r.convolver.disconnect(); } catch (e) {}
  const out = getCtx().createGain();
  out.gain.value = 0.9;
  r.convolver.connect(out);
  out.connect(dryBus);
}
