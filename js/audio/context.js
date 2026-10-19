// AudioContext und Master-Kette (Kompressor als Schutz vor Übersteuerung bei vielen Stimmen).
let ctx = null;
let master = null;
let comp = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 0.7;
    comp.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function getMaster() {
  getCtx();
  return comp; // Eingang der Master-Kette
}

export async function unlockAudio() {
  const c = getCtx();
  if (c.state !== 'running') {
    try {
      await c.resume();
    } catch (e) {
      /* ignorieren */
    }
  }
  return c;
}

export function now() {
  return getCtx().currentTime;
}

export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

export function setMasterVolume(v) {
  getCtx();
  master.gain.value = v;
}
