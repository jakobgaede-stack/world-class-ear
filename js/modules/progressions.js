// Modul Akkordfolgen: Stufen und Funktionen hören, Sequenzen, Neapolitaner und übermäßige Sextakkorde, Modulationen.
import { pick, randInt, shuffle, pc, pcName, midiToHelmholtz } from '../theory/pitch.js';
import { ensembleName } from '../audio/ensembles.js';
import { chordEvents, preload, play, el } from './common.js';

// Vokabular: pcs relativ zum Grundton der Tonart, bass = relative Tonklasse im Bass
const MAJ = {
  'I': { pcs: [0, 4, 7], bass: 0, fn: 'T' },
  'I⁶': { pcs: [0, 4, 7], bass: 4, fn: 'T³ (Terz im Bass)' },
  'I⁶₄': { pcs: [0, 4, 7], bass: 7, fn: 'D⁶₄ (kadenzierender Quartsextakkord)' },
  'ii': { pcs: [2, 5, 9], bass: 2, fn: 'Sp' },
  'ii⁶': { pcs: [2, 5, 9], bass: 5, fn: 'Sp³' },
  'ii⁷': { pcs: [2, 5, 9, 0], bass: 2, fn: 'Sp⁷' },
  'ii⁶₅': { pcs: [2, 5, 9, 0], bass: 5, fn: 'Sp⁷ (Terz im Bass)' },
  'iii': { pcs: [4, 7, 11], bass: 4, fn: 'Dp' },
  'IV': { pcs: [5, 9, 0], bass: 5, fn: 'S' },
  'IV⁶': { pcs: [5, 9, 0], bass: 9, fn: 'S³' },
  'IV⁷': { pcs: [5, 9, 0, 4], bass: 5, fn: 'S⁷ (große Septime)' },
  'V': { pcs: [7, 11, 2], bass: 7, fn: 'D' },
  'V⁶': { pcs: [7, 11, 2], bass: 11, fn: 'D³' },
  'V⁷': { pcs: [7, 11, 2, 5], bass: 7, fn: 'D⁷' },
  'V⁶₅': { pcs: [7, 11, 2, 5], bass: 11, fn: 'D⁷ (Terz im Bass)' },
  'V⁴₃': { pcs: [7, 11, 2, 5], bass: 2, fn: 'D⁷ (Quinte im Bass)' },
  'V²': { pcs: [7, 11, 2, 5], bass: 5, fn: 'D⁷ (Septime im Bass)' },
  'vi': { pcs: [9, 0, 4], bass: 9, fn: 'Tp' },
  'vi⁷': { pcs: [9, 0, 4, 7], bass: 9, fn: 'Tp⁷' },
  'vii°': { pcs: [11, 2, 5], bass: 11, fn: 'Ð (verkürzter D⁷)' },
  'vii°⁶': { pcs: [11, 2, 5], bass: 2, fn: 'Ð (Terz im Bass)' },
  'viiø⁷': { pcs: [11, 2, 5, 9], bass: 11, fn: 'D⁹ ohne Grundton' },
  'V/V': { pcs: [2, 6, 9], bass: 2, fn: 'DD' },
  'V⁷/V': { pcs: [2, 6, 9, 0], bass: 2, fn: 'DD⁷' },
  'V/ii': { pcs: [9, 1, 4], bass: 9, fn: '(D) [Sp]' },
  'V⁷/ii': { pcs: [9, 1, 4, 7], bass: 9, fn: '(D⁷) [Sp]' },
  'V/vi': { pcs: [4, 8, 11], bass: 4, fn: '(D) [Tp]' },
  'V⁷/vi': { pcs: [4, 8, 11, 2], bass: 4, fn: '(D⁷) [Tp]' },
  'V⁷/IV': { pcs: [0, 4, 7, 10], bass: 0, fn: '(D⁷) [S]' },
  'vii°⁷/V': { pcs: [6, 9, 0, 3], bass: 6, fn: 'ÐD⁷ (verkürzter DD⁷)' },
  'N⁶': { pcs: [1, 5, 8], bass: 5, fn: 'sN (Neapolitaner)' },
  'It⁶': { pcs: [8, 0, 6], bass: 8, fn: 'DD-Variante (italienischer Sextakkord)' },
  'Fr⁶': { pcs: [8, 0, 2, 6], bass: 8, fn: 'DD-Variante (französischer Sextakkord)' },
  'Ger⁶': { pcs: [8, 0, 3, 6], bass: 8, fn: 'DD-Variante (deutscher Sextakkord)' },
  'iv': { pcs: [5, 8, 0], bass: 5, fn: 's (Moll-Subdominante)' },
  '♭VI': { pcs: [8, 0, 3], bass: 8, fn: 'tG (Trugschluss-Variante)' },
  '♭VII': { pcs: [10, 2, 5], bass: 10, fn: 'dP (aus der Variante)' },
};
const MIN = {
  'i': { pcs: [0, 3, 7], bass: 0, fn: 't' },
  'i⁶': { pcs: [0, 3, 7], bass: 3, fn: 't³' },
  'i⁶₄': { pcs: [0, 3, 7], bass: 7, fn: 'D⁶₄ (kadenzierender Quartsextakkord)' },
  'ii°': { pcs: [2, 5, 8], bass: 2, fn: 's⁶ ohne Grundton (verminderte Sp)' },
  'ii°⁶': { pcs: [2, 5, 8], bass: 5, fn: 's⁶' },
  'iiø⁷': { pcs: [2, 5, 8, 0], bass: 2, fn: 'sP⁷ / verk. DD' },
  'III': { pcs: [3, 7, 10], bass: 3, fn: 'tP' },
  'iv': { pcs: [5, 8, 0], bass: 5, fn: 's' },
  'iv⁶': { pcs: [5, 8, 0], bass: 8, fn: 's³' },
  'V': { pcs: [7, 11, 2], bass: 7, fn: 'D' },
  'V⁷': { pcs: [7, 11, 2, 5], bass: 7, fn: 'D⁷' },
  'V⁶₅': { pcs: [7, 11, 2, 5], bass: 11, fn: 'D⁷ (Terz im Bass)' },
  'VI': { pcs: [8, 0, 3], bass: 8, fn: 'sP / tG' },
  'VII': { pcs: [10, 2, 5], bass: 10, fn: 'dP' },
  'vii°⁷': { pcs: [11, 2, 5, 8], bass: 11, fn: 'Ð⁷ (verkürzter D⁹)' },
  'N⁶': { pcs: [1, 5, 8], bass: 5, fn: 'sN (Neapolitaner)' },
  'Ger⁶': { pcs: [8, 0, 3, 6], bass: 8, fn: 'DD-Variante (deutscher Sextakkord)' },
  'It⁶': { pcs: [8, 0, 6], bass: 8, fn: 'DD-Variante (italienischer Sextakkord)' },
  'V/V': { pcs: [2, 6, 9], bass: 2, fn: 'DD' },
  'V⁷/iv': { pcs: [0, 4, 7, 10], bass: 0, fn: '(D⁷) [s]' },
  'I': { pcs: [0, 4, 7], bass: 0, fn: 'T (picardische Terz)' },
};

const RANGES = { S: [60, 79], A: [55, 74], T: [48, 67], B: [40, 57] };

/** Vierstimmiger Satz mit sparsamer Stimmführung (kleinste Bewegung, keine Parallelen, keine Kreuzung). */
export function voiceLead(chords, tonic) {
  const out = [];
  let prev = null;
  for (const ch of chords) {
    const pcs = ch.pcs.map((x) => pc(x + tonic));
    const bassPc = pc(ch.bass + tonic);
    // Bass: nächstgelegener Ton im Bereich
    const bassCands = [];
    for (let m = RANGES.B[0]; m <= RANGES.B[1]; m++) if (pc(m) === bassPc) bassCands.push(m);
    const bass = prev ? bassCands.sort((a, b) => Math.abs(a - prev[0]) - Math.abs(b - prev[0]))[0] : bassCands.sort((a, b) => Math.abs(a - 48) - Math.abs(b - 48))[0];
    const cand = (lo, hi) => { const r = []; for (let m = lo; m <= hi; m++) if (pcs.includes(pc(m))) r.push(m); return r; };
    const S = cand(...RANGES.S);
    const A = cand(...RANGES.A);
    const T = cand(...RANGES.T);
    let best = null;
    let bestCost = Infinity;
    const leading = pc(tonic + 11);
    for (const s of S) for (const a of A) for (const t of T) {
      if (!(s >= a && a >= t && t > bass)) continue;
      if (s - a > 12 || a - t > 12) continue;
      const v = [bass, t, a, s];
      const present = new Set(v.map(pc));
      let cost = 0;
      // Vollständigkeit: Grundton und Terz müssen vorkommen, Quinte darf fehlen
      if (!present.has(pcs[0]) || !present.has(pcs[1])) cost += 12;
      if (pcs.length === 4 && !present.has(pcs[3])) cost += 6;
      if (pcs.length === 3 && !present.has(pcs[2])) cost += 2;
      // verdoppelter Leitton
      if (v.filter((m) => pc(m) === leading).length > 1) cost += 8;
      if (prev) {
        for (let i = 1; i < 4; i++) cost += Math.abs(v[i] - prev[i]);
        // Parallelen (Oktaven/Quinten) zwischen allen Stimmpaaren
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
          const d0 = (prev[j] - prev[i]) % 12;
          const d1 = (v[j] - v[i]) % 12;
          if ((d0 === 7 && d1 === 7) || (d0 === 0 && d1 === 0)) if (v[i] !== prev[i]) cost += 10;
        }
      } else {
        cost += Math.abs(s - 67) * 0.3 + (s - t > 14 ? 3 : 0);
      }
      if (cost < bestCost) { bestCost = cost; best = v; }
    }
    if (!best) best = [bass, bass + 12, bass + 16, bass + 19];
    out.push(best);
    prev = best;
  }
  return out;
}

const stages = [
  { diff: 8, label: 'Hauptdreiklänge und vi, Grundstellung, Klavier', minor: false, vocab: ['I', 'IV', 'V', 'vi'], templates: [['I', 'IV', 'V', 'I'], ['I', 'V', 'vi', 'IV'], ['I', 'vi', 'IV', 'V'], ['I', 'IV', 'I', 'V'], ['I', 'vi', 'V', 'I']], hearings: 2, ens: ['piano'] },
  { diff: 18, label: 'alle Stufen, Sextakkorde', minor: false, vocab: ['I', 'I⁶', 'ii', 'ii⁶', 'iii', 'IV', 'IV⁶', 'V', 'V⁶', 'vi', 'vii°⁶'], templates: [['I', 'vi', 'ii⁶', 'V', 'I'], ['I', 'V⁶', 'vi', 'iii', 'IV'], ['I', 'IV⁶', 'I⁶', 'ii', 'V'], ['I', 'vii°⁶', 'I⁶', 'IV', 'V'], ['I', 'iii', 'vi', 'ii⁶', 'V', 'I']], hearings: 2, ens: ['piano', 'organ'] },
  { diff: 30, label: 'Septakkorde und Umkehrungen des Dominantseptakkords, kadenzierender Quartsextakkord', minor: false, vocab: ['I', 'I⁶', 'I⁶₄', 'ii', 'ii⁷', 'ii⁶₅', 'IV', 'IV⁷', 'V', 'V⁷', 'V⁶₅', 'V⁴₃', 'V²', 'vi', 'vi⁷', 'viiø⁷'], templates: [['I', 'ii⁷', 'V⁷', 'I'], ['I', 'IV', 'I⁶₄', 'V⁷', 'I'], ['I', 'V⁴₃', 'I⁶', 'ii⁶₅', 'V', 'I'], ['I', 'V²', 'I⁶', 'IV⁷', 'V⁷', 'I'], ['I', 'vi⁷', 'ii⁷', 'V⁷', 'I'], ['I', 'viiø⁷', 'I', 'IV', 'V⁶₅', 'I']], hearings: 2, ens: ['piano', 'strings', 'organ'] },
  { diff: 42, label: 'Moll: Stufen, verminderter Septakkord, Trugschluss', minor: true, vocab: ['i', 'i⁶', 'ii°⁶', 'iiø⁷', 'III', 'iv', 'iv⁶', 'V', 'V⁷', 'VI', 'VII', 'vii°⁷'], templates: [['i', 'iv', 'V', 'i'], ['i', 'VI', 'ii°⁶', 'V⁷', 'i'], ['i', 'VII', 'III', 'iv', 'V', 'i'], ['i', 'vii°⁷', 'i', 'iv⁶', 'V', 'VI'], ['i', 'iiø⁷', 'V⁷', 'VI', 'iv', 'V', 'i']], hearings: 2, ens: ['piano', 'strings', 'woodwinds', 'organ'] },
  { diff: 54, label: 'Zwischendominanten', minor: false, vocab: ['I', 'ii', 'IV', 'V', 'V⁷', 'vi', 'V/V', 'V⁷/V', 'V/ii', 'V⁷/ii', 'V/vi', 'V⁷/vi', 'V⁷/IV', 'vii°⁷/V'], templates: [['I', 'V⁷/IV', 'IV', 'V', 'I'], ['I', 'V/V', 'V', 'I'], ['I', 'V⁷/vi', 'vi', 'ii', 'V', 'I'], ['I', 'V⁷/ii', 'ii', 'V⁷', 'I'], ['I', 'vii°⁷/V', 'V', 'I'], ['I', 'V/vi', 'vi', 'V⁷/V', 'V', 'I']], hearings: 2, ens: ['piano', 'strings', 'brass', 'mixed'] },
  { diff: 66, label: 'Quintfallsequenz, Neapolitaner, übermäßige Sextakkorde, Moll-Subdominante', minor: null, vocabMajor: ['I', 'ii⁷', 'iii', 'IV', 'IV⁷', 'V', 'V⁷', 'vi', 'vi⁷', 'viiø⁷', 'N⁶', 'It⁶', 'Fr⁶', 'Ger⁶', 'iv', '♭VI', 'I⁶₄'], vocabMinor: ['i', 'i⁶₄', 'ii°⁶', 'iiø⁷', 'III', 'iv', 'V', 'V⁷', 'VI', 'VII', 'N⁶', 'Ger⁶', 'It⁶', 'vii°⁷'], templatesMajor: [['I', 'IV⁷', 'viiø⁷', 'iii', 'vi⁷', 'ii⁷', 'V⁷', 'I'], ['I', 'N⁶', 'V⁷', 'I'], ['I', 'vi', 'Ger⁶', 'I⁶₄', 'V⁷', 'I'], ['I', 'iv', 'I', '♭VI', 'V⁷', 'I'], ['I', 'It⁶', 'V', 'I'], ['I', 'Fr⁶', 'V⁷', 'I']], templatesMinor: [['i', 'N⁶', 'V⁷', 'i'], ['i', 'iv', 'Ger⁶', 'i⁶₄', 'V⁷', 'i'], ['i', 'VI', 'N⁶', 'V', 'i'], ['i', 'VII', 'III', 'VI', 'iiø⁷', 'V⁷', 'i'], ['i', 'It⁶', 'V', 'i']], hearings: 2, ens: ['piano', 'strings', 'brass', 'mixed', 'organ'] },
  { diff: 78, label: 'Modulation: in welche Tonart wird moduliert?', modulation: true, hearings: 2, ens: ['piano', 'strings', 'organ', 'mixed'] },
  { diff: 90, label: 'acht Akkorde gemischt, Orchester, ein Durchgang', minor: null, vocabMajor: ['I', 'I⁶', 'ii⁷', 'IV', 'V⁷', 'V⁶₅', 'vi', 'V/V', 'V⁷/vi', 'N⁶', 'Ger⁶', 'iv', 'I⁶₄'], vocabMinor: ['i', 'i⁶', 'iiø⁷', 'iv', 'V⁷', 'VI', 'N⁶', 'Ger⁶', 'vii°⁷', 'i⁶₄', 'VII', 'III'], templatesMajor: [['I', 'V⁷/vi', 'vi', 'iv', 'I⁶', 'N⁶', 'I⁶₄', 'V⁷'], ['I', 'ii⁷', 'V/V', 'V⁷', 'vi', 'Ger⁶', 'I⁶₄', 'V⁷'], ['I', 'I⁶', 'IV', 'V⁶₅', 'I', 'iv', 'V⁷', 'I']], templatesMinor: [['i', 'VII', 'III', 'VI', 'N⁶', 'i⁶₄', 'V⁷', 'i'], ['i', 'iiø⁷', 'V⁷', 'VI', 'Ger⁶', 'i⁶₄', 'V⁷', 'i'], ['i', 'i⁶', 'iv', 'vii°⁷', 'i', 'VI', 'V⁷', 'i']], hearings: 1, ens: ['orchestra', 'mixed', 'brass', 'strings'] },
];

const MOD_TARGETS = [
  { key: 'V', label: 'zur Dominante (V)', shift: 7, minor: false },
  { key: 'IV', label: 'zur Subdominante (IV)', shift: 5, minor: false },
  { key: 'vi', label: 'zur Tonikaparallele (vi)', shift: 9, minor: true },
  { key: 'ii', label: 'zur Subdominantparallele (ii)', shift: 2, minor: true },
  { key: 'iii', label: 'zur Dominantparallele (iii)', shift: 4, minor: true },
  { key: 'i', label: 'zur Varianttonart (i)', shift: 0, minor: true },
];

function keyLabel(tonic, minor) {
  const flats = [5, 10, 3, 8, 1].includes(tonic);
  const name = pcName(tonic, { flats });
  return minor ? name.toLowerCase() + '-Moll' : name + '-Dur';
}

function buildChords(labels, vocab) {
  return labels.map((l) => ({ label: l, ...vocab[l] }));
}

export const SKILLS = [
  {
    id: 'harm_prog',
    name: 'Akkordfolgen (Stufen und Funktionen)',
    family: 'harmony',
    stages,
    itemSeconds: 40,
    dailyMin: 8,
    dailyMax: 16,
    importance: 1.2,
    generate(stageIndex) {
      const stage = stages[stageIndex];
      const tonic = randInt(0, 11);
      const ens = pick(stage.ens);
      if (stage.modulation) {
        const target = pick(MOD_TARGETS);
        const newTonic = pc(tonic + target.shift);
        const vocabOld = MAJ;
        const vocabNew = target.minor ? MIN : MAJ;
        const oldPart = buildChords(pick([['I', 'IV', 'V', 'I'], ['I', 'vi', 'IV', 'V', 'I'], ['I', 'V⁷', 'I']]), vocabOld).map((c) => ({ ...c, pcs: c.pcs, bass: c.bass, tonic }));
        const newLabels = target.minor ? ['ii°⁶', 'V⁷', 'i', 'iv', 'V⁷', 'i'] : ['ii⁶', 'V⁷', 'I', 'IV', 'V⁷', 'I'];
        const newPart = buildChords(newLabels, vocabNew).map((c) => ({ ...c, tonic: newTonic }));
        const seq = [...oldPart, ...newPart];
        // Stimmführung über beide Teile: pcs auf absolute Tonklassen bringen, dann mit tonic 0 führen
        const abs = seq.map((c) => ({ pcs: c.pcs.map((x) => pc(x + c.tonic)), bass: pc(c.bass + c.tonic) }));
        const voicings = voiceLead(abs, 0);
        const durs = seq.map((_, i) => (i === seq.length - 1 ? 1.8 : 1.0));
        const events = [];
        let t = 0;
        voicings.forEach((v, i) => { events.push(...chordEvents(v, ens, { dur: durs[i] * 0.97, t })); t += durs[i]; });
        return {
          skill: 'harm_prog',
          stageIndex,
          diff: stage.diff,
          title: 'Modulation',
          hint: `Ausgangstonart ${keyLabel(tonic, false)} · ${ensembleName(ens)} · ${stage.hearings} Durchgänge · Wohin wird moduliert?`,
          replays: stage.hearings - 1,
          manualStart: true,
          knowledge: 'harmony:modulation',
          async load(p) { await preload(events, p); },
          play() { return play(events); },
          renderAnswer(container, submit) {
            const grid = el('div', { class: 'agrid cols-3' });
            for (const tg of MOD_TARGETS) grid.appendChild(el('button', { class: 'abtn', text: tg.label, onclick: () => submit(tg.key) }));
            container.appendChild(grid);
          },
          evaluate(answer) {
            const correct = answer === target.key;
            return {
              score: correct ? 1 : 0,
              correct,
              truthKey: target.key,
              answerKey: answer,
              truthLabel: `${target.label}: ${keyLabel(tonic, false)} → ${keyLabel(newTonic, target.minor)} · Folge: ${seq.map((c) => c.label).join(' – ')}`,
              answerLabel: MOD_TARGETS.find((x) => x.key === answer)?.label || answer,
              playTruth: () => play(events),
              playAnswer: null,
            };
          },
        };
      }
      const minor = stage.minor === null ? Math.random() < 0.5 : stage.minor;
      const vocab = minor ? MIN : MAJ;
      const vocabList = stage.vocab || (minor ? stage.vocabMinor : stage.vocabMajor);
      const templates = stage.templates || (minor ? stage.templatesMinor : stage.templatesMajor);
      const labels = pick(templates);
      const chords = buildChords(labels, vocab);
      const voicings = voiceLead(chords, tonic);
      const durs = chords.map((_, i) => (i === chords.length - 1 ? 1.7 : 1.0));
      const events = [];
      let t = 0;
      voicings.forEach((v, i) => { events.push(...chordEvents(v, ens, { dur: durs[i] * 0.97, t })); t += durs[i]; });
      const nAsk = chords.length - 1; // erster Akkord ist die Tonika (gegeben)
      return {
        skill: 'harm_prog',
        stageIndex,
        diff: stage.diff + (chords.length - 4),
        title: 'Akkordfolge',
        hint: `${keyLabel(tonic, minor)} · ${chords.length} Akkorde, der erste ist ${labels[0]} · ${ensembleName(ens)} · ${stage.hearings} ${stage.hearings === 1 ? 'Durchgang' : 'Durchgänge'}`,
        replays: stage.hearings - 1,
        manualStart: true,
        knowledge: stage.diff === 66 ? 'harmony:sequence' : stage.diff === 30 || stage.diff === 42 ? 'harmony:cadence' : 'harmony:functions',
        async load(p) { await preload(events, p); },
        play() { return play(events); },
        renderAnswer(container, submit) {
          const chosen = new Array(chords.length).fill(null);
          chosen[0] = labels[0];
          let cur = 1;
          const strip = el('div', { class: 'slot-strip' });
          const slots = chords.map((_, i) => {
            const b = el('button', { class: 'slot' + (i === 0 ? ' given' : '') + (i === cur ? ' current' : ''), text: i === 0 ? labels[0] : '·' });
            if (i > 0) b.addEventListener('click', () => { cur = i; refresh(); });
            strip.appendChild(b);
            return b;
          });
          const grid = el('div', { class: 'agrid cols-6' });
          for (const l of vocabList) {
            const b = el('button', { class: 'abtn', type: 'button', onclick: () => { chosen[cur] = l; if (cur < chords.length - 1) cur++; refresh(); } });
            b.appendChild(el('span', { class: 'abtn-label', text: l }));
            if (vocab[l]?.fn) b.appendChild(el('span', { class: 'abtn-sub', text: vocab[l].fn }));
            grid.appendChild(b);
          }
          const btn = el('button', { class: 'btn primary', text: 'Antworten', disabled: 'disabled' });
          const refresh = () => {
            slots.forEach((s, i) => { s.classList.toggle('current', i === cur); if (i > 0) s.textContent = chosen[i] || '·'; });
            if (chosen.every((x) => x)) btn.removeAttribute('disabled');
          };
          btn.addEventListener('click', () => submit(chosen.slice()));
          container.appendChild(strip);
          container.appendChild(grid);
          container.appendChild(el('div', { class: 'row-right' }, btn));
        },
        evaluate(answer) {
          let hits = 0;
          const parts = [];
          chords.forEach((c, i) => {
            if (i === 0) return;
            const ok = answer[i] === c.label;
            if (ok) hits++;
            if (!ok) parts.push(`${i + 1}. gewählt ${answer[i] || '–'}, richtig ${c.label} (${c.fn})`);
          });
          const score = hits / nAsk;
          const ansChords = answer.map((l) => vocab[l]).filter(Boolean);
          return {
            score,
            correct: score >= 0.999,
            truthKey: labels.slice(1).join(' '),
            answerKey: answer.slice(1).join(' '),
            truthLabel: labels.map((l) => `${l} (${vocab[l].fn})`).join(' – '),
            answerLabel: answer.slice(1).join(' – ') + ` · ${hits} von ${nAsk} richtig`,
            detail: parts.join(' · '),
            playTruth: () => play(events),
            playAnswer: ansChords.length === chords.length ? () => { const vs = voiceLead(ansChords, tonic); const ev = []; let tt = 0; vs.forEach((v, i) => { ev.push(...chordEvents(v, ens, { dur: durs[i] * 0.97, t: tt })); tt += durs[i]; }); return play(ev); } : null,
            truthPlayLabel: 'Original',
            answerPlayLabel: 'deine Folge',
          };
        },
      };
    },
  },
];
