// Tonhöhen, Namen und Umrechnungen. Referenz: MIDI 60 = c' (C4), a' = 440 Hz.

export const PC_SHARP = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
export const PC_FLAT = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'];
export const PC_EN_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const PC_EN_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function pc(m) {
  return ((m % 12) + 12) % 12;
}

/** Deutscher Tonname mit Helmholtz-Oktave: 60 -> c', 48 -> c, 36 -> C, 24 -> C1 (Kontra), 72 -> c''. */
export function midiToHelmholtz(m, { flats = false } = {}) {
  const names = flats ? PC_FLAT : PC_SHARP;
  const name = names[pc(m)];
  const octave = Math.floor(m / 12) - 1; // 60 -> 4
  if (octave >= 3) {
    const primes = "'".repeat(octave - 3);
    return name.toLowerCase() + primes;
  }
  if (octave === 2) return name; // großes C
  // Kontra- und Subkontra-Oktave: C1, C2 als Index
  const n = 2 - octave; // 1 -> 1, 0 -> 2
  return name + n;
}

/** Deutscher Tonname mit wissenschaftlicher Oktave (c' = C4). */
export function midiToSci(m, { flats = false } = {}) {
  const names = flats ? PC_FLAT : PC_SHARP;
  return names[pc(m)] + (Math.floor(m / 12) - 1);
}

/** Nur Tonklasse, deutsch. */
export function pcName(p, { flats = false } = {}) {
  return (flats ? PC_FLAT : PC_SHARP)[pc(p)];
}

export function pcNameEn(p, { flats = false } = {}) {
  return (flats ? PC_EN_FLAT : PC_EN_SHARP)[pc(p)];
}

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** music21-Schreibweise ('B-4', 'F#4', 'E--3', 'C4') -> MIDI. */
export function spellingToMidi(s) {
  const m = /^([A-G])([#\-]*)(-?\d+)$/.exec(s.trim());
  if (!m) throw new Error('Ungültige Tonhöhe: ' + s);
  let p = LETTER_PC[m[1]];
  for (const ch of m[2]) p += ch === '#' ? 1 : -1;
  return p + (parseInt(m[3], 10) + 1) * 12;
}

/** music21-Schreibweise -> deutscher Name ohne Oktave ('B-' -> 'B', 'B' -> 'H', 'E-' -> 'Es', 'A-' -> 'As', 'C#' -> 'Cis'). */
export function spellingToGerman(s) {
  const m = /^([A-G])([#\-]*)(-?\d+)?$/.exec(s.trim());
  if (!m) return s;
  const letter = m[1];
  const acc = m[2];
  const octave = m[3];
  let name;
  if (letter === 'B' && acc === '') name = 'H';
  else if (letter === 'B' && acc === '-') name = 'B';
  else if (letter === 'B' && acc === '--') name = 'Heses';
  else if (acc === '') name = letter;
  else if (acc === '#') name = letter + 'is';
  else if (acc === '##') name = letter + 'isis';
  else if (acc === '-') name = letter === 'E' ? 'Es' : letter === 'A' ? 'As' : letter + 'es';
  else if (acc === '--') name = letter === 'E' ? 'Eses' : letter === 'A' ? 'Asas' : letter + 'eses';
  else name = letter + acc;
  if (octave === undefined) return name;
  return name + octave;
}

/** music21-Schreibweise -> VexFlow-Key ('B-4' -> 'bb/4', 'F#4' -> 'f#/4', 'C4' -> 'c/4'). */
export function spellingToVex(s, octaveShift = 0) {
  const m = /^([A-G])([#\-]*)(-?\d+)$/.exec(s.trim());
  if (!m) throw new Error('Ungültige Tonhöhe: ' + s);
  const acc = m[2].replace(/-/g, 'b');
  return m[1].toLowerCase() + acc + '/' + (parseInt(m[3], 10) + octaveShift);
}

/** Vorzeichen einer Schreibweise als VexFlow-Kürzel ('#', 'b', 'n', '##', 'bb') oder null. */
export function spellingAccidental(s) {
  const m = /^([A-G])([#\-]*)/.exec(s.trim());
  if (!m || m[2] === '') return null;
  return m[2].replace(/-/g, 'b');
}

/** Tonart-String von music21 ('G major', 'd minor', 'E- major') -> { tonic (pc), mode, pcs (Set der Leitertöne) }. */
export function parseKey(keyStr) {
  const m = /^([A-Ga-g])([#\-]*)\s+(major|minor)$/.exec(keyStr.trim());
  if (!m) return { tonic: 0, mode: 'major', pcs: new Set([0, 2, 4, 5, 7, 9, 11]), label: keyStr };
  let p = LETTER_PC[m[1].toUpperCase()];
  for (const ch of m[2]) p += ch === '#' ? 1 : -1;
  p = pc(p);
  const mode = m[3];
  const steps = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10, 11]; // Moll mit Leitton
  const pcs = new Set(steps.map((s) => pc(p + s)));
  const flats = m[2].includes('-') || (mode === 'major' ? [5, 10, 3, 8, 1].includes(p) : [2, 7, 0, 5, 10].includes(p));
  const name = pcName(p, { flats });
  const label = mode === 'major' ? name + '-Dur' : name.toLowerCase() + '-Moll';
  return { tonic: p, mode, pcs, label, flats };
}

/** Dur-Tonart (für VexFlow-Vorzeichen) aus Quintenzahl: -1 -> 'F', 2 -> 'D'. */
export function fifthsToVexKey(fifths) {
  const majors = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const flats = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
  return fifths >= 0 ? majors[Math.min(fifths, 7)] : flats[Math.min(-fifths, 7)];
}

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Gewichtete Auswahl: items = [{v, w}] */
export function weightedPick(items) {
  const total = items.reduce((s, it) => s + it.w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it.v;
  }
  return items[items.length - 1].v;
}

/** music21-Schreibweise ('B-3') -> deutscher Name mit Helmholtz-Oktave ('B' = b, 'B3' -> b). */
export function spellingToHelmholtz(s) {
  const m = /^([A-G])([#\-]*)(-?\d+)$/.exec(String(s).trim());
  if (!m) return s;
  const name = spellingToGerman(m[1] + m[2]);
  const octave = parseInt(m[3], 10);
  if (octave >= 3) return name.toLowerCase() + "'".repeat(octave - 3);
  if (octave === 2) return name;
  return name + (2 - octave);
}
