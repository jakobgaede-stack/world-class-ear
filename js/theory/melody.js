// Melodiegenerator für Blattsingen und Diktat: tonal (Stufen, Sprünge), chromatisch, modulierend, atonal nach Edlund-Stufen.
import { pc, pick, randInt, PC_SHARP, PC_FLAT } from './pitch.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR_H = [0, 2, 3, 5, 7, 8, 11]; // harmonisch (Leitton)
const SOLFEGE_MAJOR = ['do', 're', 'mi', 'fa', 'so', 'la', 'ti'];
const SOLFEGE_MINOR = ['do', 're', 'me', 'fa', 'so', 'le', 'ti']; // do-basiertes Moll
const SHARP_KEYS = new Set([0, 7, 2, 9, 4, 11, 6]);

// Edlund-Stufen: kumulativ erlaubte Intervalle (Halbtöne)
export const EDLUND = [
  { label: 'Sekunden und Terzen', iv: [1, 2, 3, 4] },
  { label: 'plus Quarten', iv: [1, 2, 3, 4, 5] },
  { label: 'plus Tritonus', iv: [1, 2, 3, 4, 5, 6] },
  { label: 'plus Quinten', iv: [1, 2, 3, 4, 5, 6, 7] },
  { label: 'plus Sexten', iv: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { label: 'plus Septimen', iv: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { label: 'Sprünge über die Oktave', iv: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
];

/** Schreibweise eines MIDI-Tons in einer Tonart (music21-Stil, z. B. 'B-3'). */
export function spellInKey(midi, tonic, minor = false) {
  const flats = !SHARP_KEYS.has(tonic) || (minor && [5, 10, 3, 8, 1].includes(tonic));
  const names = flats ? ['C', 'D-', 'D', 'E-', 'E', 'F', 'G-', 'G', 'A-', 'A', 'B-', 'B'] : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // Leitton in Moll als Kreuz (z. B. G# in a-Moll)
  let name = names[pc(midi)];
  if (minor && pc(midi) === pc(tonic + 11) && name.includes('-')) {
    const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    name = sharpNames[pc(midi)];
  }
  return name + (Math.floor(midi / 12) - 1);
}

export function spellAtonal(midi, prevMidi) {
  const up = prevMidi === undefined || midi >= prevMidi;
  const names = up ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] : ['C', 'D-', 'D', 'E-', 'E', 'F', 'G-', 'G', 'A-', 'A', 'B-', 'B'];
  return names[pc(midi)] + (Math.floor(midi / 12) - 1);
}

/**
 * Relative Solmisation (movable do). Moll wahlweise la-basiert (Kodály, Standard im deutschsprachigen Raum:
 * Tonika = la, Leitton = si) oder do-basiert (Tonika = do, kleine Terz = me, kleine Sexte = le, kleine Septime = te).
 */
export function solfege(midi, tonic, minor = false, laMinor = true) {
  if (minor && laMinor) return solfege(midi, pc(tonic + 3), false, true);
  const steps = minor ? MINOR_H : MAJOR;
  const d = pc(midi - tonic);
  const i = steps.indexOf(d);
  if (i >= 0) return (minor ? SOLFEGE_MINOR : SOLFEGE_MAJOR)[i];
  // chromatische Töne (aufwärts erhöht, abwärts erniedrigt vereinfacht)
  const chrom = { 1: 'di', 3: minor ? 'me' : 'ri', 6: 'fi', 8: minor ? 'le' : 'si', 10: 'te' };
  return chrom[d] || '?';
}

/** Rhythmusmuster (Viertel) für n Töne: Stufe 'plain' (nur Viertel/Halbe), 'simple', 'dotted', 'syncopated' */
function rhythmFor(n, level, beats = 4) {
  const out = [];
  const pool = level === 'plain' ? [1, 1, 1, 2] : level === 'simple' ? [1, 1, 0.5, 0.5, 2, 1] : level === 'dotted' ? [1, 0.5, 1.5, 0.5, 1, 2, 0.75, 0.25] : [0.5, 1, 1.5, 0.5, 0.25, 0.75, 1, 2];
  let pos = 0;
  for (let i = 0; i < n; i++) {
    let d = pick(pool);
    const inBar = pos % beats;
    // keine Dauer über die Taktgrenze hinweg
    if (inBar + d > beats) d = beats - inBar;
    if (i === n - 1) d = Math.max(d, 1);
    out.push(d);
    pos += d;
  }
  // Letzter Ton füllt den Takt auf (kein unvollständiger Schlusstakt)
  const rest = pos % beats;
  if (rest > 1e-6) out[out.length - 1] += beats - rest;
  return out;
}

/**
 * Melodie erzeugen.
 * opts: { kind: 'tonal'|'chromatic'|'modulating'|'atonal', minor, n (Töne), lo, hi (MIDI-Bereich), maxLeap (Halbtöne), edlund (Index), rhythm ('none'|'plain'|'simple'|'dotted'|'syncopated'), beats }
 * Rückgabe: { notes: [{m, o, d, spelling, syl}], tonic, minor, keyLabel, quarterLength, beats, kind }
 */
export function generateMelody(opts = {}) {
  const kind = opts.kind || 'tonal';
  const n = opts.n || 8;
  const lo = opts.lo ?? 43;
  const hi = opts.hi ?? 65;
  const minor = !!opts.minor;
  const tonic = opts.tonic ?? randInt(0, 11);
  const beats = opts.beats || 4;
  const rhythm = opts.rhythm || 'none';
  const laMinor = opts.laMinor !== false;
  const durs = rhythm === 'none' ? Array(n).fill(1) : rhythmFor(n, rhythm, beats);
  if (rhythm === 'none' && n % beats) durs[n - 1] += beats - (n % beats);
  const notes = [];
  let m;
  if (kind === 'atonal') {
    const set = EDLUND[Math.min(opts.edlund ?? 0, EDLUND.length - 1)].iv;
    m = randInt(lo + 4, hi - 4);
    let prev;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        let tries = 0;
        let next;
        do {
          const iv = pick(set) * (Math.random() < 0.5 ? 1 : -1);
          next = m + iv;
          tries++;
        } while ((next < lo || next > hi || next === prev) && tries < 30);
        if (next < lo || next > hi) next = m - Math.sign(m - (lo + hi) / 2) * pick(set);
        prev = m;
        m = next;
      }
      notes.push({ m, spelling: spellAtonal(m, prev), syl: '' });
    }
  } else {
    const steps = minor ? MINOR_H : MAJOR;
    const scale = [];
    for (let x = lo; x <= hi; x++) if (steps.includes(pc(x - tonic))) scale.push(x);
    const maxLeap = opts.maxLeap ?? 4;
    // Start auf Grundton, Terz oder Quinte
    const starts = scale.filter((x) => [0, 4, 7, 3].includes(pc(x - tonic)) && Math.abs(x - (lo + hi) / 2) <= 7);
    m = pick(starts.length ? starts : scale);
    let idx = scale.indexOf(m);
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        let step;
        const r = Math.random();
        if (r < 0.55) step = Math.random() < 0.5 ? 1 : -1;
        else step = randInt(-maxLeap, maxLeap);
        let ni = idx + step;
        if (ni < 0 || ni >= scale.length) ni = idx - step;
        ni = Math.max(0, Math.min(scale.length - 1, ni));
        if (i === n - 1) {
          // Schluss auf Grundton oder Terz in der Nähe
          const ends = scale.map((x, k) => ({ x, k })).filter((o) => [0, 4, 3].includes(pc(o.x - tonic)) && Math.abs(o.k - idx) <= 3);
          if (ends.length) ni = pick(ends).k;
        }
        idx = ni;
        m = scale[idx];
        // chromatische Durchgänge
        if (kind === 'chromatic' && Math.random() < 0.3 && i < n - 1) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          const chrom = m + dir;
          if (chrom > lo && chrom < hi && !steps.includes(pc(chrom - tonic))) {
            notes.push({ m: chrom, spelling: spellInKey(chrom, tonic, minor), syl: solfege(chrom, tonic, minor, laMinor) });
            continue;
          }
        }
      }
      notes.push({ m, spelling: spellInKey(m, tonic, minor), syl: solfege(m, tonic, minor, laMinor) });
    }
  }
  // Dauern und Offsets
  let o = 0;
  notes.forEach((nt, i) => {
    nt.o = o;
    nt.d = durs[i];
    o += nt.d;
  });
  const quarterLength = o;
  const flats = !SHARP_KEYS.has(tonic);
  const keyLabel = kind === 'atonal' ? 'frei (atonal)' : (minor ? (flats ? PC_FLAT : PC_SHARP)[tonic].toLowerCase() + '-Moll' : (flats ? PC_FLAT : PC_SHARP)[tonic] + '-Dur');
  return { notes, tonic, minor, keyLabel, quarterLength, beats, kind };
}

/** Quintenzahl der Tonart (für VexFlow-Vorzeichnung) */
export function fifthsOf(tonic, minor = false) {
  const majorTonic = minor ? pc(tonic + 3) : pc(tonic);
  const map = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
  return map[majorTonic] ?? 0;
}

/** Melodie als Ausschnitt-Objekt für renderExcerpt (eine Stimme) */
export function melodyToExcerpt(mel, { clef = 'bass', name = 'M', showSyllables = false, fifths = null } = {}) {
  const beats = mel.beats || 4;
  const measures = [];
  let off = 0;
  let num = 1;
  while (off < mel.quarterLength - 1e-6) {
    const q = Math.min(beats, mel.quarterLength - off);
    measures.push({ number: num, offset: off, end: off + q, quarters: q });
    off += q;
    num++;
  }
  const notes = mel.notes.map((n, idx) => ({ m: n.m, o: n.o, d: n.d, tie: null, fermata: false, spelling: n.spelling, idx, lyric: showSyllables ? n.syl : undefined }));
  const keySig = fifths !== null ? fifths : mel.kind === 'atonal' ? 0 : fifthsOf(mel.tonic, mel.minor);
  return {
    chorale: { keySig, measures: measures.map((m) => ({ number: m.number, offset: m.offset, quarters: m.quarters })) },
    start: 0,
    end: mel.quarterLength,
    parts: [{ name, clef, notes }],
    measures,
    key: { flats: keySig < 0, label: mel.keyLabel },
    timeSig: beats + '/4',
  };
}
