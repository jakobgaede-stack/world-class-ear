// Zugriff auf den Choralkorpus (JSON je Choral) und Phrasenausschnitte.
import { parseKey, spellingToMidi } from '../theory/pitch.js';

const BASE = 'assets/chorales/';
let index = null;
const cache = new Map();

export async function loadIndex() {
  if (!index) {
    const res = await fetch(BASE + 'index.json');
    index = await res.json();
    index.chorales = index.chorales.filter((c) => !c.flags?.some((f) => f.startsWith('duplicateOf')));
  }
  return index;
}

export async function loadChorale(id) {
  if (cache.has(id)) return cache.get(id);
  const res = await fetch(`${BASE}${id}.json`);
  const c = await res.json();
  c.key = parseKey(c.keyAnalyzed);
  cache.set(id, c);
  return c;
}

export async function randomChorale(filter) {
  const idx = await loadIndex();
  let list = idx.chorales;
  if (filter) list = list.filter(filter);
  const meta = list[Math.floor(Math.random() * list.length)];
  return loadChorale(meta.id);
}

/**
 * Ausschnitt [start, end) in Vierteln: Stimmen mit Noten (geklippt), Takte, Phrasen.
 * Noten werden kopiert; Felder: m, o, d, tie, fermata, spelling, idx (Index in der Originalstimme).
 */
export function excerpt(chorale, start, end) {
  const parts = chorale.parts.map((p) => ({
    name: p.name,
    clef: p.clef,
    notes: p.notes
      .map((n, idx) => ({ ...n, idx }))
      .filter((n) => n.o + n.d > start + 1e-6 && n.o < end - 1e-6)
      .map((n) => {
        const o = Math.max(n.o, start);
        const e = Math.min(n.o + n.d, end);
        return { ...n, o, d: e - o, clippedStart: o > n.o, clippedEnd: e < n.o + n.d };
      }),
  }));
  const measures = chorale.measures.filter((m) => m.offset + m.quarters > start + 1e-6 && m.offset < end - 1e-6).map((m) => ({
    number: m.number,
    offset: Math.max(m.offset, start),
    end: Math.min(m.offset + m.quarters, end),
    fullQuarters: m.quarters,
  }));
  return { chorale, start, end, parts, measures, key: chorale.key, timeSig: chorale.timeSig };
}

/** Phrasen 1 bis n ab einer zufälligen Phrase (zusammenhängend) */
export function randomPhraseSpan(chorale, nPhrases = 1) {
  const ph = chorale.phrases;
  const maxStart = Math.max(0, ph.length - nPhrases);
  const i = Math.floor(Math.random() * (maxStart + 1));
  const sel = ph.slice(i, i + nPhrases);
  return { start: sel[0].start, end: sel[sel.length - 1].end, phraseIndex: i };
}

/** Tonklassen, die zur Zeit t in den Stimmen (außer partIdx) klingen */
export function soundingPcs(parts, t, exceptPart = -1) {
  const pcs = new Set();
  const midis = [];
  parts.forEach((p, pi) => {
    if (pi === exceptPart) return;
    for (const n of p.notes) {
      if (n.o <= t + 1e-6 && n.o + n.d > t + 1e-6) {
        pcs.add(((n.m % 12) + 12) % 12);
        midis.push(n.m);
      }
    }
  });
  return { pcs, midis };
}

export { spellingToMidi };
