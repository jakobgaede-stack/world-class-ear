// Orchesterliteratur: Index und Ausschnitte (MIT-lizenzierte Werke aus dem Repo, nutzungsbeschränkte über den privaten Worker).
import { parseKey } from '../theory/pitch.js';
import { state } from '../engine/state.js';

const BASE = 'assets/orchestra/';
const WORKER = 'https://world-class-ear-sync.jakobgaede.workers.dev/lit/';
let index = null;
const cache = new Map();

export async function loadOrchestraIndex() {
  if (!index) {
    const res = await fetch(BASE + 'index.json');
    index = await res.json();
  }
  return index;
}

function isRestricted(work) {
  return !!work.restricted;
}

export async function loadExcerpt(id, work) {
  if (cache.has(id)) return cache.get(id);
  let data;
  if (work && isRestricted(work)) {
    const key = state.settings.syncKey || '';
    if (key.length < 6) throw new Error('Für Haydn-Ausschnitte ist ein Sync-Schlüssel nötig (Einstellungen), weil die Notendaten nur privat weitergegeben werden dürfen.');
    const res = await fetch(WORKER + id, { headers: { 'X-WCE-Key': key } });
    if (!res.ok) throw new Error('Ausschnitt nicht ladbar (' + res.status + ')');
    data = await res.json();
  } else {
    const res = await fetch(BASE + id + '.json');
    if (!res.ok) throw new Error('Ausschnitt nicht ladbar (' + res.status + ')');
    data = await res.json();
  }
  cache.set(id, data);
  return data;
}

/** Nutzungsbeschränkte Werke sind nur mit Sync-Schlüssel erreichbar (privater Worker). */
export function restrictedAvailable() {
  return (state.settings.syncKey || '').length >= 6;
}

/** Alle Ausschnitt-Einträge (mit Werk) als flache Liste, optional gefiltert; beschränkte Werke nur bei Schlüssel. */
export async function listExcerpts(filter) {
  const idx = await loadOrchestraIndex();
  const out = [];
  const withRestricted = restrictedAvailable();
  for (const w of idx.works) {
    if (isRestricted(w) && !withRestricted) continue;
    for (const m of w.movements) for (const e of m.excerpts) {
      const entry = { ...e, work: w, movement: m };
      if (!filter || filter(entry)) out.push(entry);
    }
  }
  return out;
}

/** Werkliste für Anzeige (Statistik/Wissen): Titel, Ausschnitte, Verfügbarkeit. */
export async function worksOverview() {
  const idx = await loadOrchestraIndex();
  const withRestricted = restrictedAvailable();
  return idx.works.map((w) => ({
    id: w.id,
    title: w.title || w.work || w.id,
    restricted: isRestricted(w),
    available: !isRestricted(w) || withRestricted,
    excerpts: w.movements.reduce((s, m) => s + m.excerpts.length, 0),
    movements: w.movements.length,
  }));
}

export async function randomExcerpt(filter) {
  const list = await listExcerpts(filter);
  if (!list.length) return null;
  const entry = list[Math.floor(Math.random() * list.length)];
  const data = await loadExcerpt(entry.id, entry.work);
  return { entry, data };
}

/** Ausschnitt in das Format von excerpt() (Choräle) überführen. */
export function toExcerpt(data) {
  const measures = data.measures.map((m) => ({ number: m.number, offset: m.offset, end: m.offset + m.quarters, fullQuarters: m.quarters }));
  const autoClef = (p) => {
    const clef = p.clef || 'treble';
    if (clef !== 'treble' || !p.notes.length) return clef;
    if (!['horn', 'trumpet', 'trombone', 'tuba', 'timpani', 'bassoon', 'cello', 'contrabass'].includes(p.inst)) return clef;
    const ms = p.notes.map((n) => n.m).sort((a, b) => a - b);
    const median = ms[Math.floor(ms.length / 2)];
    return median < 57 ? 'bass' : clef; // klingend tiefe Hörner/Trompeten im Bassschlüssel lesbar halten
  };
  const parts = data.parts.map((p) => ({
    name: p.name,
    abbr: p.abbr || p.name,
    clef: autoClef(p),
    inst: p.inst,
    range: p.notes.length ? [Math.min(...p.notes.map((n) => n.m)) - 3, Math.max(...p.notes.map((n) => n.m)) + 3] : [36, 84],
    notes: p.notes.map((n, idx) => ({ ...n, idx, fermata: !!n.fermata })),
  }));
  return {
    chorale: { keySig: data.keySig || 0, measures: data.measures.map((m) => ({ number: m.number, offset: m.offset, quarters: m.quarters })), title: data.work, bwv: '', riemenschneider: '' },
    start: 0,
    end: data.quarterLength,
    parts,
    measures,
    key: parseKey(data.keyAnalyzed || 'C major'),
    timeSig: data.timeSig || '4/4',
    meta: data,
  };
}

/** Stimmen ohne Noten entfernen, Reihenfolge beibehalten; Rückgabe Indizes der aktiven Stimmen. */
export function activeParts(ex) {
  return ex.parts.map((p, i) => (p.notes.length ? i : -1)).filter((i) => i >= 0);
}
