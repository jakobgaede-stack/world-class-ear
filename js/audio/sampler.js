// Sampler: lädt die Instrument-Samples (OGG je MIDI-Ton) und spielt Töne mit Hüllkurve, Pitch-Shift und Pegel.
import { getCtx, getMaster, dbToGain, unlockAudio } from './context.js';
import { makeSpatial, wireReverb } from './space.js';
import { state } from '../engine/state.js';

let reverbWired = false;
function outputFor(ctx, inst, opts) {
  const bus = getMaster();
  if (!reverbWired) { try { wireReverb(bus); } catch (e) {} reverbWired = true; }
  const sp = makeSpatial(ctx, inst, opts);
  sp.connect(bus);
  return sp.input;
}

const BASE = 'assets/samples/';
const NP_URL = 'https://world-class-ear-sync.jakobgaede.workers.dev/np/';
const NP_CACHE = 'wce-np-1';
let manifest = null;
let npInfo = null; // Manifest der privaten NotePerformer-Bibliothek, wenn aktiv

/** Klangbibliothek: 'noteperformer' (privat, braucht Sync-Schlüssel) oder 'vsco' (frei). */
export function soundSet() {
  const key = state.settings.syncKey || '';
  const want = state.settings.soundSet || 'noteperformer';
  return want === 'noteperformer' && key.length >= 6 ? 'noteperformer' : 'vsco';
}

async function npFetch(name) {
  const url = NP_URL + name;
  let cache = null;
  try { cache = await caches.open(NP_CACHE); } catch (e) { cache = null; }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) return hit.arrayBuffer();
  }
  const res = await fetch(url, { headers: { 'X-WCE-Key': state.settings.syncKey || '' } });
  if (!res.ok) throw new Error('NotePerformer-Klänge nicht ladbar (' + res.status + ')');
  const buf = await res.arrayBuffer();
  if (cache) { try { await cache.put(url, new Response(buf.slice(0), { headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' } })); } catch (e) {} }
  return buf;
}

/** Bündel zerlegen: 'WCEB' + uint32 Kopf-Länge + JSON-Kopf + OGG-Daten */
function parseBundle(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'WCEB') throw new Error('Ungültiges Klangbündel');
  const hl = dv.getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
  const base = 8 + hl;
  return head.notes.map(([midi, off, len]) => ({ midi, data: buf.slice(base + off, base + off + len) }));
}
const buffers = new Map(); // 'inst/art' -> Map(midi -> AudioBuffer)
const pending = new Map();
const active = new Set();

export async function loadManifest() {
  if (!manifest) {
    const res = await fetch(BASE + 'manifest.json');
    manifest = await res.json();
    if (soundSet() === 'noteperformer') {
      try {
        npInfo = JSON.parse(new TextDecoder().decode(await npFetch('manifest')));
        for (const [inst, info] of Object.entries(npInfo.instruments)) {
          const base = manifest.instruments[inst];
          manifest.instruments[inst] = { ...info, np: true, range: base ? base.range : info.range, playingRange: base ? base.playingRange : info.playingRange };
        }
      } catch (e) {
        console.warn('NotePerformer-Klänge nicht verfügbar, verwende VSCO:', e.message);
        npInfo = null;
      }
    }
  }
  return manifest;
}

export function npActive() {
  return !!npInfo;
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

/** Artikulation eines Ereignisses inklusive Dynamikschicht (leise gehaltene Töne aus der p-Aufnahme). */
export function artFor(e) {
  const a = resolveArt(e.inst, e.art || 'sus');
  if (a === 'sus' && (e.gainDb ?? 0) <= -5 && hasArticulation(e.inst, 'sus_p')) return 'sus_p';
  return a;
}

/** Artikulation mit Fallback: stac/pizz -> sus wenn nicht vorhanden. */
export function resolveArt(inst, art) {
  if (inst === 'sine') return 'sus';
  if (hasArticulation(inst, art)) return art;
  if (art === 'sus_p') return 'sus';
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
  if (info.np) {
    const pn = (async () => {
      const parts = parseBundle(await npFetch(info.articulations[realArt].bundle));
      const map = new Map();
      let done = 0;
      await Promise.all(parts.map(async (x) => {
        try { map.set(x.midi, await ctx.decodeAudioData(x.data)); } catch (e) { console.warn('NP-Ton nicht dekodierbar', inst, realArt, x.midi); }
        done++;
        if (onProgress) onProgress(done / parts.length);
      }));
      if (map.size === 0) throw new Error(`Keine Klänge für ${inst} (${realArt}).`);
      buffers.set(key, map);
      pending.delete(key);
      return map;
    })();
    pending.set(key, pn);
    pn.catch(() => pending.delete(key));
    return pn;
  }
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
  await loadManifest();
  const uniq = [...new Set(list.filter((x) => x.inst !== 'sine').map((x) => x.inst + '/' + artFor(x)))];
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
  const out = outputFor(ctx, o.inst, { pan: o.pan ?? null, voiceIndex: o.voiceIndex || 0, voices: o.voices || 1 });
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
  let art = artFor(o);
  let map = buffers.get(o.inst + '/' + art);
  if (!map && art === 'sus_p') { art = 'sus'; map = buffers.get(o.inst + '/sus'); }
  if (!map) {
    console.warn('Instrument nicht geladen:', o.inst, art);
    return { stop() {} };
  }
  const sm = nearestSample(map, o.midi);
  const buf = map.get(sm);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const cents = o.detune || 0;
  src.playbackRate.value = Math.pow(2, (o.midi - sm) / 12 + cents / 1200);
  src.connect(g);
  const isShort = art === 'stac' || art === 'pizz';
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
  const human = state.settings.humanize !== false;
  const n = events.length;
  events.forEach((e, i) => {
    const jitter = human ? (Math.random() - 0.5) * 0.014 : 0;
    const detune = human ? (Math.random() - 0.5) * 7 : 0;
    handles.push(playNote({ ...e, when: t0 + e.t + Math.max(0, jitter + 0.007), detune: e.detune ?? detune, voiceIndex: e.voiceIndex ?? i, voices: e.voices ?? n }));
    last = Math.max(last, e.t + (e.dur ?? 1) + 0.2);
  });
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
