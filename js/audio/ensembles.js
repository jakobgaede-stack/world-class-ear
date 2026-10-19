// Besetzungen: ordnet Stimmen (MIDI, aufsteigend) Instrumenten zu.
import { getManifest, hasArticulation } from './sampler.js';
import { pick, shuffle } from '../theory/pitch.js';

export const ENSEMBLES = {
  sine: { de: 'Sinus', diff: 0 },
  piano: { de: 'Klavier', diff: 2 },
  strings: { de: 'Streicher', diff: 5, insts: ['contrabass', 'cello', 'viola', 'violin'] },
  woodwinds: { de: 'Holzbläser', diff: 6, insts: ['bassoon', 'clarinet', 'oboe', 'flute'] },
  brass: { de: 'Blechbläser', diff: 7, insts: ['tuba', 'trombone', 'horn', 'trumpet'] },
  mixed: { de: 'gemischte Familien', diff: 10 },
  choir: { de: 'Chor', diff: 6 },
  organ: { de: 'Orgel', diff: 5 },
  orchestra: { de: 'Orchestersatz (Verdopplungen)', diff: 12 },
};

export const ENSEMBLE_ORDER = ['sine', 'piano', 'strings', 'woodwinds', 'brass', 'mixed', 'choir', 'organ', 'orchestra'];

const MELODIC = ['flute', 'oboe', 'clarinet', 'bassoon', 'horn', 'trumpet', 'trombone', 'tuba', 'violin', 'viola', 'cello', 'contrabass'];

function range(inst) {
  const info = getManifest()?.instruments?.[inst];
  return info ? info.playingRange || info.range : [0, 127];
}

function inRange(inst, midi) {
  const [lo, hi] = range(inst);
  return midi >= lo && midi <= hi;
}

/** Instrument aus einer Liste wählen, das den Ton spielen kann; bevorzugt den gewünschten Index. */
function fromFamily(list, midi, preferredIdx) {
  const pref = list[preferredIdx];
  if (inRange(pref, midi)) return pref;
  // nächstgelegenes passendes Instrument
  const order = list.map((inst, i) => ({ inst, d: Math.abs(i - preferredIdx) })).sort((a, b) => a.d - b.d);
  for (const o of order) if (inRange(o.inst, midi)) return o.inst;
  // Notlösung: Instrument mit kleinstem Abstand zum Ambitus
  let best = pref;
  let bestD = Infinity;
  for (const inst of list) {
    const [lo, hi] = range(inst);
    const d = midi < lo ? lo - midi : midi > hi ? midi - hi : 0;
    if (d < bestD) { bestD = d; best = inst; }
  }
  return best;
}

/**
 * Stimmen zuweisen.
 * @param {string} ensembleId
 * @param {number[]} midis aufsteigend sortiert
 * @param {string} art 'sus' | 'stac' | 'pizz'
 * @returns {Array<{inst:string, art:string, midi:number}>}
 */
export function assignVoices(ensembleId, midis, art = 'sus') {
  const n = midis.length;
  const out = [];
  if (ensembleId === 'sine') return midis.map((midi) => ({ inst: 'sine', art: 'sus', midi }));
  if (ensembleId === 'piano' || ensembleId === 'organ' || ensembleId === 'choir') {
    const inst = ensembleId;
    return midis.map((midi) => ({ inst, art: 'sus', midi: clampToRange(inst, midi) }));
  }
  if (ensembleId === 'strings' || ensembleId === 'woodwinds' || ensembleId === 'brass') {
    const list = ENSEMBLES[ensembleId].insts;
    for (let i = 0; i < n; i++) {
      const prefIdx = n === 1 ? list.length - 1 : Math.round((i * (list.length - 1)) / (n - 1));
      const inst = fromFamily(list, midis[i], prefIdx);
      out.push({ inst, art, midi: midis[i] });
    }
    return out;
  }
  if (ensembleId === 'mixed') {
    const pool = shuffle(MELODIC);
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const cands = pool.filter((inst) => inRange(inst, midis[i]) && !used.has(inst));
      const inst = cands.length ? cands[0] : fromFamily(MELODIC, midis[i], 0);
      used.add(inst);
      out.push({ inst, art, midi: midis[i] });
    }
    return out;
  }
  if (ensembleId === 'orchestra') {
    // jede Stimme doppelt besetzt aus zwei Familien, Bass zusätzlich eine Oktave tiefer
    const fams = [ENSEMBLES.strings.insts, ENSEMBLES.woodwinds.insts, ENSEMBLES.brass.insts];
    for (let i = 0; i < n; i++) {
      const prefIdxOf = (list) => (n === 1 ? list.length - 1 : Math.round((i * (list.length - 1)) / (n - 1)));
      const chosen = shuffle(fams).slice(0, 2);
      for (const list of chosen) out.push({ inst: fromFamily(list, midis[i], prefIdxOf(list)), art, midi: midis[i], gainDb: -3 });
      if (i === 0 && midis[0] - 12 >= 28) out.push({ inst: 'contrabass', art, midi: midis[0] - 12, gainDb: -4 });
    }
    return out;
  }
  return midis.map((midi) => ({ inst: 'piano', art: 'sus', midi }));
}

function clampToRange(inst, midi) {
  const [lo, hi] = range(inst);
  let m = midi;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

/** Besetzung für eine einzelne Melodiestimme */
export function soloInstrument(ensembleId, midiLo, midiHi) {
  if (ensembleId === 'sine' || ensembleId === 'piano' || ensembleId === 'organ' || ensembleId === 'choir') return ensembleId;
  const list = ensembleId === 'mixed' || ensembleId === 'orchestra' ? MELODIC : ENSEMBLES[ensembleId].insts;
  const cands = list.filter((inst) => inRange(inst, midiLo) && inRange(inst, midiHi));
  return cands.length ? pick(cands) : fromFamily(list, Math.round((midiLo + midiHi) / 2), list.length - 1);
}

export function ensembleName(id) {
  return ENSEMBLES[id]?.de || id;
}

export { hasArticulation };

/**
 * Instrumente für Stimmen mit bekanntem Ambitus (z. B. Choral S/A/T/B).
 * partRanges: [{lo, hi}] in Reihenfolge Sopran -> Bass (von oben nach unten).
 * Rückgabe: Instrument-Id je Stimme.
 */
export function assignParts(ensembleId, partRanges) {
  const n = partRanges.length;
  if (['sine', 'piano', 'organ', 'choir'].includes(ensembleId)) return partRanges.map(() => ensembleId);
  const covers = (inst, r) => { const [lo, hi] = range(inst); return r.lo >= lo && r.hi <= hi; };
  const coverage = (inst, r) => { const [lo, hi] = range(inst); const o = Math.min(hi, r.hi) - Math.max(lo, r.lo); return o / (r.hi - r.lo + 1); };
  const pickFrom = (list, r, prefIdx) => {
    const order = list.map((inst, i) => ({ inst, d: Math.abs(i - prefIdx) })).sort((a, b) => a.d - b.d).map((o) => o.inst);
    for (const inst of order) if (covers(inst, r)) return inst;
    return order.slice().sort((a, b) => coverage(b, r) - coverage(a, r))[0];
  };
  if (ensembleId === 'mixed' || ensembleId === 'orchestra') {
    const pool = shuffle(MELODIC);
    const used = new Set();
    return partRanges.map((r) => {
      const cands = pool.filter((inst) => covers(inst, r) && !used.has(inst));
      const inst = cands.length ? cands[0] : pool.slice().sort((a, b) => coverage(b, r) - coverage(a, r))[0];
      used.add(inst);
      return inst;
    });
  }
  const list = (ENSEMBLES[ensembleId]?.insts || ENSEMBLES.strings.insts).slice().reverse(); // hoch -> tief
  return partRanges.map((r, i) => pickFrom(list, r, n === 1 ? 0 : Math.round((i * (list.length - 1)) / (n - 1))));
}
