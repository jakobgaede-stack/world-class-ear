// Sampler: lädt die Instrument-Samples (OGG je MIDI-Ton) und spielt Töne mit Hüllkurve, Pitch-Shift und Pegel.
import { getCtx, getMaster, dbToGain, unlockAudio } from './context.js';

const BASE = 'assets/samples/';
let manifest = null;
const buffers = new Map(); // 'inst/art' -> Map(midi -> AudioBuffer)
const pending = new Map();
const active = new Set();

export async function loadManifest() {
  if (!manifest) {
    const res = await fetch(BASE + 'manifest.json');
    manifest = await res.json();
  }
  return manifest;
}

export function getManifest() {
  return manifest;
}

export function instrumentInfo(inst) {
  return manifest?.instruments?.[inst] || null;
}

export function hasArticulation(inst, art) {
  const info = instrumentInfo(inst);
  return !!(info && info.articulations[art]);
}

/** Artikulation mit Fallback: stac/pizz -> sus wenn nicht vorhanden. */
export function resolveArt(inst, art) {
  if (inst === 'sine') return 'sus';
  if (hasArticulation(inst, art)) return art;
  if (art === 'pizz' && hasArticulation(inst, 'stac')) return 'stac';
  return 'sus';
}

export async function loadInstrument(inst, art = 'sus', onProgress) {
  if (inst === 'sine') return null;
  await loadManifest();
  const realArt = resolveArt(inst, art);
  const key = inst + '/' + realArt;
  if (buffers.has(key)) return buffers.get(key);
  if (pending.has(key)) return pending.get(key);
  const info = instrumentInfo(inst);
  if (!info) throw new Error('Unbekanntes Instrument: ' + inst);
  const notes = info.articulations[realArt].notes;
  const ctx = getCtx();
  const p = (async () => {
    const map = new Map();
    let done = 0;
    await Promise.all(
      notes.map(async (midi) => {
        const url = `${BASE}${inst}/${realArt}/${midi}.ogg`;
        const tryLoad = async (opts) => {
          const res = await fetch(url, opts);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return ctx.decodeAudioData(await res.arrayBuffer());
        };
        try {
          map.set(midi, await tryLoad({}));
        } catch (e1) {
          try {
            map.set(midi, await tryLoad({ cache: 'reload' }));
          } catch (e2) {
            console.warn('Sample nicht ladbar, wird übersprungen:', url, e2.message);
          }
        }
        done++;
        if (onProgress) onProgress(done / notes.length);
      })
    );
    if (map.size === 0) throw new Error(`Keine Klänge für ${inst} (${realArt}) ladbar. Bitte Seite neu laden.`);
    buffers.set(key, map);
    pending.delete(key);
    return map;
  })();
  pending.set(key, p);
  return p;
}

/** Alle Instrumente einer Liste laden (für ein Item), mit Gesamtfortschritt. */
export async function loadAll(list, onProgress) {
  const uniq = [...new Set(list.map((x) => x.inst + '/' + resolveArt(x.inst, x.art || 'sus')))];
  let done = 0;
  await Promise.all(
    uniq.map(async (key) => {
      const [inst, art] = key.split('/');
      await loadInstrument(inst, art);
      done++;
      if (onProgress) onProgress(done / uniq.length);
    })
  );
}

function nearestSample(map, midi) {
  let bestMidi = null;
  let bestDist = Infinity;
  for (const m of map.keys()) {
    const d = Math.abs(m - midi);
    if (d < bestDist || (d === bestDist && m < midi)) {
      bestDist = d;
      bestMidi = m;
    }
  }
  return bestMidi;
}

/**
 * Einen Ton spielen.
 * @param {object} o  inst, art, midi, when (absolute Zeit, 0 = sofort), dur (s), gainDb, release (s)
 * @returns {{stop:(t?:number)=>void}}
 */
export function playNote(o) {
  const ctx = getCtx();
  const when = o.when && o.when > 0 ? o.when : ctx.currentTime + 0.03;
  const dur = o.dur ?? 1;
  const gainDb = o.gainDb ?? 0;
  const release = o.release ?? 0.12;
  const out = getMaster();
  const g = ctx.createGain();
  g.connect(out);
  const peak = dbToGain(gainDb) * (o.gain ?? 1);
  if (o.inst === 'sine') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440 * Math.pow(2, (o.midi - 69) / 12);
    const amp = peak * 0.35;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp, when + 0.02);
    g.gain.setValueAtTime(amp, when + dur);
    g.gain.linearRampToValueAtTime(0, when + dur + release);
    osc.connect(g);
    osc.start(when);
    osc.stop(when + dur + release + 0.05);
    const h = { stop: (t) => { try { osc.stop(t ?? ctx.currentTime); } catch (e) {} } };
    osc.onended = () => { active.delete(h); g.disconnect(); };
    active.add(h);
    return h;
  }
  const art = resolveArt(o.inst, o.art || 'sus');
  const map = buffers.get(o.inst + '/' + art);
  if (!map) {
    console.warn('Instrument nicht geladen:', o.inst, art);
    return { stop() {} };
  }
  const sm = nearestSample(map, o.midi);
  const buf = map.get(sm);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (o.midi - sm) / 12);
  src.connect(g);
  const isShort = art !== 'sus';
  const sampleLen = buf.duration / src.playbackRate.value;
  g.gain.setValueAtTime(peak, when);
  let end;
  if (isShort) {
    end = Math.min(sampleLen, dur < 0.25 ? dur + 0.05 : sampleLen);
    if (end < sampleLen) g.gain.linearRampToValueAtTime(0, when + end);
  } else {
    end = Math.min(dur, sampleLen - 0.05);
    g.gain.setValueAtTime(peak, when + end);
    g.gain.linearRampToValueAtTime(0, when + end + release);
  }
  src.start(when);
  src.stop(when + end + release + 0.05);
  const h = {
    stop: (t) => {
      const tt = t ?? ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(tt);
        g.gain.setValueAtTime(g.gain.value, tt);
        g.gain.linearRampToValueAtTime(0, tt + 0.08);
        src.stop(tt + 0.1);
      } catch (e) {}
    },
  };
  src.onended = () => { active.delete(h); try { g.disconnect(); } catch (e) {} };
  active.add(h);
  return h;
}

/** Alle laufenden Töne stoppen. */
export function stopAll() {
  const ctx = getCtx();
  for (const h of [...active]) h.stop(ctx.currentTime);
  active.clear();
}

/**
 * Ereignisse abspielen: events = [{inst, art, midi, t (s relativ), dur, gainDb}]
 * Rückgabe: Promise, das nach dem letzten Ton erfüllt wird, plus stop().
 */
export function playEvents(events, { lead = 0.08 } = {}) {
  const ctx = getCtx();
  const t0 = ctx.currentTime + lead;
  let last = 0;
  const handles = [];
  for (const e of events) {
    handles.push(playNote({ ...e, when: t0 + e.t }));
    last = Math.max(last, e.t + (e.dur ?? 1) + 0.2);
  }
  let timer;
  const done = new Promise((res) => {
    timer = setTimeout(res, (last + lead) * 1000);
  });
  return {
    done,
    stop() {
      clearTimeout(timer);
      for (const h of handles) h.stop();
    },
    duration: last + lead,
  };
}

export async function ensureAudio() {
  await unlockAudio();
  await loadManifest();
}

/** Verfügbare Sample-Dauer (s) für Instrument/Artikulation/Ton; Sinus = unbegrenzt. */
export function sampleSeconds(inst, art, midi) {
  if (inst === 'sine') return 999;
  const realArt = resolveArt(inst, art || 'sus');
  const map = buffers.get(inst + '/' + realArt);
  if (!map) return 3;
  const sm = nearestSample(map, midi);
  const buf = map.get(sm);
  return buf ? buf.duration / Math.pow(2, (midi - sm) / 12) : 3;
}

/**
 * Akkord halten: die Ereignisse (alle bei t = 0) werden zyklisch mit Überlappung erneut angestoßen,
 * bis stop() gerufen wird. Rückgabe wie playEvents, zusätzlich hold: true.
 */
export function playHold(events) {
  let stopped = false;
  let timer = null;
  const handles = [];
  let period = 5;
  for (const e of events) period = Math.min(period, sampleSeconds(e.inst, e.art, e.midi) - 0.45);
  period = Math.max(1.2, Math.min(5, period));
  const cycle = () => {
    if (stopped) return;
    const h = playEvents(events.map((e) => ({ ...e, t: 0, dur: period + 0.35 })), { lead: 0.05 });
    handles.push(h);
    if (handles.length > 3) handles.shift();
    timer = setTimeout(cycle, period * 1000);
  };
  cycle();
  return {
    hold: true,
    done: new Promise(() => {}),
    duration: Infinity,
    stop() {
      stopped = true;
      clearTimeout(timer);
      for (const h of handles) h.stop();
    },
  };
}
