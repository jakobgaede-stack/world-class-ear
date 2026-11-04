// Modul Diktat: Melodie, Zwölfton, zwei- bis vierstimmig (Choräle). Eingabe auf dem Bildschirmklavier.
import { generateMelody, EDLUND, spellAtonal } from '../theory/melody.js';
import { randomChorale, randomPhraseSpan, excerpt } from '../data/chorales.js';
import { renderExcerpt } from '../notation/score.js';
import { soloInstrument, ensembleName, assignParts } from '../audio/ensembles.js';
import { pick, randInt, shuffle, midiToHelmholtz, pcName, pc, spellingToHelmholtz } from '../theory/pitch.js';
import { el, preload, play, melodyEvents } from './common.js';
import { sequenceInput } from '../ui/sequence_input.js';
import { keyboard } from '../ui/keyboard.js';
import { choraleEvents, PART_DE } from './errors.js';

const E_PIANO = ['piano'];
const E_HOMO = ['piano', 'strings', 'woodwinds', 'brass'];
const E_ALL = ['piano', 'strings', 'woodwinds', 'brass', 'mixed', 'choir', 'organ'];

/** Zuordnung (DTW) zweier Tonfolgen, exakte MIDI-Gleichheit; Rückgabe match[i] = Index der Antwort oder null */
function alignExact(expected, answer, eq = (a, b) => a === b) {
  const n = expected.length;
  const m = answer.length;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) D[i][0] = i;
  for (let j = 1; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j - 1] + (eq(expected[i - 1], answer[j - 1]) ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
  const match = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const c = eq(expected[i - 1], answer[j - 1]) ? 0 : 1;
    if (D[i][j] === D[i - 1][j - 1] + c) { match[i - 1] = c === 0 ? j - 1 : null; i--; j--; }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  return match;
}

// ---------- Melodiediktat ----------
const melStages = [
  { diff: 8, label: 'diatonisch, 4 bis 6 Töne, Anfangston gegeben, drei Durchgänge', kind: 'tonal', n: [4, 6], maxLeap: 2, rhythm: 'none', hearings: 3, ens: E_PIANO, first: true },
  { diff: 18, label: 'Sprünge bis zur Quinte, Dur und Moll, homogener Satz', kind: 'tonal', n: [6, 8], maxLeap: 4, minorChance: 0.4, rhythm: 'none', hearings: 3, ens: E_HOMO, first: true },
  { diff: 30, label: 'rhythmisiert, chromatische Durchgänge, zwei Durchgänge', kind: 'chromatic', n: [8, 12], maxLeap: 5, minorChance: 0.5, rhythm: 'simple', hearings: 2, ens: E_HOMO, first: false },
  { diff: 44, label: 'länger, punktiert, gemischte Farben', kind: 'chromatic', n: [10, 14], maxLeap: 6, minorChance: 0.5, rhythm: 'dotted', hearings: 2, ens: E_ALL, first: false },
  { diff: 58, label: 'atonal nach Edlund (Sekunden bis Quarten)', kind: 'atonal', edlund: [0, 1, 2], n: [6, 9], rhythm: 'none', hearings: 2, ens: E_HOMO, first: true },
  { diff: 72, label: 'atonal bis Septimen, rhythmisiert', kind: 'atonal', edlund: [3, 4, 5], n: [8, 12], rhythm: 'simple', hearings: 2, ens: E_ALL, first: true },
  { diff: 86, label: 'sprunghaft, synkopiert, ein Durchgang', kind: 'atonal', edlund: [6], n: [10, 14], rhythm: 'syncopated', hearings: 1, ens: E_ALL, first: true },
];

const melSkill = {
  id: 'dict_melody',
  name: 'Melodiediktat',
  family: 'dictation',
  stages: melStages,
  itemSeconds: 50,
  dailyMin: 5,
  dailyMax: 10,
  importance: 1.1,
  generate(stageIndex) {
    const stage = melStages[stageIndex];
    const n = randInt(stage.n[0], stage.n[1]);
    const minor = Math.random() < (stage.minorChance || 0);
    const mel = generateMelody({ kind: stage.kind, minor, n, lo: 55, hi: 79, maxLeap: stage.maxLeap || 4, edlund: stage.edlund ? pick(stage.edlund) : 0, rhythm: stage.rhythm, beats: 4 });
    const bpm = 80;
    const spb = 60 / bpm;
    const ens = pick(stage.ens);
    const inst = soloInstrument(ens, 55, 79);
    const events = melodyEvents(mel.notes.map((nt) => ({ midi: nt.m, t: nt.o * spb, dur: nt.d * spb * 0.92 })), inst);
    const truth = mel.notes.map((nt) => nt.m);
    return {
      skill: 'dict_melody',
      stageIndex,
      diff: stage.diff + (n - stage.n[0]),
      title: 'Melodiediktat',
      hint: `${mel.keyLabel} · ${n} Töne · ${ensembleName(ens)} · ${stage.hearings} ${stage.hearings === 1 ? 'Durchgang' : 'Durchgänge'}${stage.first ? ' · beginnt auf ' + midiToHelmholtz(truth[0]) : ''} · nur Tonhöhen eingeben`,
      replays: stage.hearings - 1,
      manualStart: true,
      knowledge: 'dictation:strategy',
      async load(p) { await preload(events, p); },
      play() { return play(events); },
      renderAnswer(container, submit) {
        sequenceInput(container, { lo: 53, hi: 81, clef: 'treble', previewInst: inst, given: stage.first ? [truth[0]] : [], onSubmit: (seq) => submit(seq), label: 'Töne der Reihe nach auf der Klaviatur antippen.' });
      },
      evaluate(answer) {
        const match = alignExact(truth, answer);
        const hits = match.filter((x) => x !== null).length;
        const score = hits / truth.length;
        const marks = [];
        mel.notes.forEach((nt, i) => { if (match[i] === null) marks.push({ part: 0, idx: i, color: '#d9534f' }); });
        const ex = melodyExcerpt(mel);
        return {
          score,
          correct: score >= 0.999 && answer.length === truth.length,
          truthKey: stage.kind,
          answerKey: score >= 0.8 ? 'gut' : score >= 0.5 ? 'teils' : 'schwach',
          truthLabel: truth.map((m) => midiToHelmholtz(m)).join(' '),
          answerLabel: answer.map((m) => midiToHelmholtz(m)).join(' ') + ` · ${hits} von ${truth.length} richtig`,
          marks,
          renderFeedbackScore(container) {
            const box = el('div', { class: 'score-box' });
            container.appendChild(box);
            renderExcerpt(box, ex, { marks, maxWidth: Math.min(container.clientWidth || 900, 1100) });
          },
          playTruth: () => play(events),
          playAnswer: answer.length ? () => play(melodyEvents(answer.map((m, i) => ({ midi: m, t: i * 0.5, dur: 0.45 })), inst)) : null,
          truthPlayLabel: 'Melodie',
          answerPlayLabel: 'deine Eingabe',
        };
      },
    };
  },
};

function melodyExcerpt(mel) {
  // Notenbild der Melodie (Violinschlüssel)
  const beats = 4;
  const measures = [];
  let off = 0;
  let num = 1;
  while (off < mel.quarterLength - 1e-6) {
    const q = Math.min(beats, mel.quarterLength - off);
    measures.push({ number: num, offset: off, end: off + q, quarters: q });
    off += q;
    num++;
  }
  const notes = mel.notes.map((n, idx) => ({ m: n.m, o: n.o, d: n.d, tie: null, fermata: false, spelling: n.spelling, idx }));
  const fifths = mel.kind === 'atonal' ? 0 : ({ 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 })[mel.minor ? pc(mel.tonic + 3) : mel.tonic] ?? 0;
  return { chorale: { keySig: fifths, measures: measures.map((m) => ({ number: m.number, offset: m.offset, quarters: m.quarters })) }, start: 0, end: mel.quarterLength, parts: [{ name: 'M', clef: 'treble', notes }], measures, key: { flats: fifths < 0 }, timeSig: '4/4' };
}

// ---------- Zwölftondiktat ----------
const ROWS = [
  { name: 'Schönberg, Suite für Klavier op. 25', pcs: [4, 5, 7, 1, 6, 3, 8, 2, 11, 0, 9, 10] },
  { name: 'Schönberg, Variationen für Orchester op. 31', pcs: [10, 4, 6, 3, 5, 9, 2, 1, 7, 8, 11, 0] },
  { name: 'Berg, Violinkonzert', pcs: [7, 10, 2, 6, 9, 0, 4, 8, 11, 1, 3, 5] },
  { name: 'Berg, Lyrische Suite (Allintervallreihe)', pcs: [5, 4, 0, 9, 7, 2, 8, 1, 3, 6, 10, 11] },
  { name: 'Webern, Konzert op. 24', pcs: [11, 10, 2, 3, 7, 6, 8, 4, 5, 0, 1, 9] },
];

function randomRow() {
  return shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
}

function rowForm(pcs, form) {
  const p0 = pcs[0];
  if (form === 'P') return pcs.slice();
  if (form === 'R') return pcs.slice().reverse();
  const inv = pcs.map((x) => (2 * p0 - x + 24) % 12);
  if (form === 'I') return inv;
  return inv.reverse();
}

function realizeRow(pcs, { lo = 55, hi = 79, wild = false } = {}) {
  const out = [];
  let prev = randInt(lo + 4, hi - 4);
  for (const p of pcs) {
    let m = prev + ((p - pc(prev) + 12) % 12);
    if (m - prev > 6) m -= 12;
    if (wild && Math.random() < 0.4) m += Math.random() < 0.5 ? 12 : -12;
    if (m < lo) m += 12;
    if (m > hi) m -= 12;
    out.push(m);
    prev = m;
  }
  return out;
}

const twelveStages = [
  { diff: 16, label: 'ungeordnet: 4 bis 5 Töne einer Reihe, zwei Durchgänge', mode: 'unordered', n: [4, 5], hearings: 2, ens: E_PIANO },
  { diff: 28, label: 'ungeordnet: 6 bis 8 Töne', mode: 'unordered', n: [6, 8], hearings: 2, ens: E_PIANO },
  { diff: 40, label: 'geordnet: 6 bis 8 Töne', mode: 'ordered', n: [6, 8], hearings: 2, ens: E_HOMO },
  { diff: 52, label: 'ganze Reihe geordnet, weite Lage', mode: 'ordered', n: [12, 12], hearings: 2, ens: E_HOMO, wild: true },
  { diff: 64, label: 'Reihen aus dem Repertoire, ein Durchgang plus Wiederholung', mode: 'ordered', n: [12, 12], hearings: 2, ens: E_ALL, repertoire: true, wild: true },
  { diff: 78, label: 'Reihenformen erkennen: Grundgestalt gegeben, gespielt wird P, I, R oder RI', mode: 'forms', n: [12, 12], hearings: 2, ens: E_ALL, repertoire: true },
];

const twelveSkill = {
  id: 'dict_twelve',
  name: 'Zwölftondiktat',
  family: 'dictation',
  stages: twelveStages,
  itemSeconds: 45,
  dailyMin: 5,
  dailyMax: 10,
  importance: 0.9,
  generate(stageIndex) {
    const stage = twelveStages[stageIndex];
    const rowInfo = stage.repertoire && Math.random() < 0.7 ? pick(ROWS) : { name: 'zufällige Reihe', pcs: randomRow() };
    const n = randInt(stage.n[0], stage.n[1]);
    let pcs = rowInfo.pcs.slice(0, n);
    let form = 'P';
    if (stage.mode === 'forms') {
      form = pick(['P', 'I', 'R', 'RI']);
      pcs = rowForm(rowInfo.pcs, form);
    }
    const midis = realizeRow(pcs, { wild: !!stage.wild });
    const ens = pick(stage.ens);
    const inst = soloInstrument(ens, 50, 84);
    const events = melodyEvents(midis.map((m, i) => ({ midi: m, t: i * 0.65, dur: 0.6 })), inst);
    const truth = pcs;
    const base = {
      skill: 'dict_twelve',
      stageIndex,
      diff: stage.diff,
      title: stage.mode === 'forms' ? 'Zwölfton: Reihenform' : stage.mode === 'unordered' ? 'Zwölfton: Töne (ungeordnet)' : 'Zwölfton: Reihe (geordnet)',
      hint: `${rowInfo.name} · ${n} Töne · ${ensembleName(ens)} · ${stage.hearings} ${stage.hearings === 1 ? 'Durchgang' : 'Durchgänge'}${stage.mode === 'unordered' ? ' · Reihenfolge egal' : stage.mode === 'ordered' ? ' · in der gespielten Reihenfolge eingeben, Oktave egal' : ' · Grundgestalt P: ' + rowInfo.pcs.map((p) => pcName(p)).join(' ')}`,
      replays: stage.hearings - 1,
      manualStart: true,
      knowledge: 'dictation:twelve',
      async load(p) { await preload(events, p); },
      play() { return play(events); },
    };
    if (stage.mode === 'forms') {
      return {
        ...base,
        renderAnswer(container, submit) {
          const grid = el('div', { class: 'agrid cols-4' });
          for (const f of ['P', 'I', 'R', 'RI']) grid.appendChild(el('button', { class: 'abtn', text: f === 'P' ? 'P (Grundgestalt)' : f === 'I' ? 'I (Umkehrung)' : f === 'R' ? 'R (Krebs)' : 'RI (Krebsumkehrung)', onclick: () => submit(f) }));
          container.appendChild(grid);
        },
        evaluate(answer) {
          const correct = answer === form;
          return { score: correct ? 1 : 0, correct, truthKey: form, answerKey: answer, truthLabel: `${form}: ${pcs.map((p) => pcName(p)).join(' ')}`, answerLabel: answer, playTruth: () => play(events), playAnswer: null };
        },
      };
    }
    return {
      ...base,
      renderAnswer(container, submit) {
        if (stage.mode === 'unordered') {
          const sel = new Set();
          const kb = keyboard(container, { lo: 60, hi: 71, selected: sel, maxSelect: 12 });
          container.appendChild(el('div', { class: 'muted small', text: 'Alle gehörten Tonklassen markieren (eine Oktave genügt).' }));
          container.appendChild(el('div', { class: 'row-right' }, el('button', { class: 'btn primary', text: 'Antworten', onclick: () => submit([...sel].map((m) => pc(m))) })));
        } else {
          sequenceInput(container, { lo: 60, hi: 71, pitchClassOnly: true, maxNotes: 12, previewInst: inst, onSubmit: (seq) => submit(seq.map((m) => pc(m))), label: 'Töne der Reihe nach antippen (eine Oktave genügt).' });
        }
      },
      evaluate(answer) {
        let score;
        let detail;
        if (stage.mode === 'unordered') {
          const t = new Set(truth);
          const a = new Set(answer);
          let hits = 0;
          for (const x of a) if (t.has(x)) hits++;
          const wrong = a.size - hits;
          score = Math.max(0, (hits - wrong) / t.size);
          detail = `${hits} von ${t.size} richtig${wrong ? ', ' + wrong + ' falsch' : ''}`;
        } else {
          const match = alignExact(truth, answer);
          const hits = match.filter((x) => x !== null).length;
          score = hits / truth.length;
          detail = `${hits} von ${truth.length} an der richtigen Stelle`;
        }
        return {
          score,
          correct: score >= 0.999,
          truthKey: stage.mode,
          answerKey: score >= 0.8 ? 'gut' : score >= 0.5 ? 'teils' : 'schwach',
          truthLabel: truth.map((p) => pcName(p)).join(' ') + (stage.mode === 'unordered' ? ' (gespielte Reihenfolge)' : ''),
          answerLabel: answer.map((p) => pcName(p)).join(' ') + ' · ' + detail,
          playTruth: () => play(events),
          playAnswer: answer.length ? () => play(melodyEvents(realizeRow(answer).map((m, i) => ({ midi: m, t: i * 0.65, dur: 0.6 })), inst)) : null,
          truthPlayLabel: 'gespielte Reihe',
          answerPlayLabel: 'deine Eingabe',
        };
      },
    };
  },
};

// ---------- Mehrstimmiges Diktat (Choräle) ----------
const polyStages = [
  { diff: 22, label: 'zwei Stimmen (Sopran und Bass), vier Durchgänge', voices: [0, 3], hearings: 4, ens: ['piano', 'organ', 'strings'], minQ: 6, maxQ: 10 },
  { diff: 36, label: 'zwei Stimmen, drei Durchgänge, längere Phrase', voices: [0, 3], hearings: 3, ens: ['piano', 'organ', 'strings', 'woodwinds'], minQ: 8, maxQ: 14 },
  { diff: 50, label: 'drei Stimmen (Sopran, Alt, Bass), vier Durchgänge', voices: [0, 1, 3], hearings: 4, ens: ['piano', 'organ', 'strings', 'choir'], minQ: 6, maxQ: 12 },
  { diff: 64, label: 'vier Stimmen, vier Durchgänge', voices: [0, 1, 2, 3], hearings: 4, ens: ['piano', 'organ', 'choir', 'strings'], minQ: 6, maxQ: 12 },
  { diff: 78, label: 'vier Stimmen, drei Durchgänge, gemischte Farben', voices: [0, 1, 2, 3], hearings: 3, ens: ['mixed', 'brass', 'woodwinds', 'choir'], minQ: 8, maxQ: 16 },
];
const VOICE_RANGE = { S: [55, 81], A: [50, 76], T: [45, 72], B: [36, 65] };

const polySkill = {
  id: 'dict_poly',
  name: 'Mehrstimmiges Diktat',
  family: 'dictation',
  stages: polyStages,
  itemSeconds: 120,
  dailyMin: 2,
  dailyMax: 5,
  importance: 1.0,
  async: true,
  async generate(stageIndex) {
    const stage = polyStages[stageIndex];
    const chorale = await randomChorale((c) => c.nPhrases >= 2);
    const span = randomPhraseSpan(chorale, 1, stage.minQ);
    let ex = excerpt(chorale, span.start, Math.min(span.end, span.start + stage.maxQ));
    const parts = stage.voices.map((i) => ex.parts[i]);
    const ens = pick(stage.ens);
    const insts = assignParts(ens, parts.map((p) => { const ms = p.notes.map((n) => n.m); return { lo: Math.min(...ms), hi: Math.max(...ms) }; }));
    const events = choraleEvents(ex, parts, ens, { bpm: 60, insts });
    const names = parts.map((p) => PART_DE[p.name] || p.name);
    return {
      skill: 'dict_poly',
      stageIndex,
      diff: stage.diff,
      title: `Diktat ${parts.length}-stimmig`,
      hint: `${chorale.title} (BWV ${chorale.bwv}) · ${ex.key.label} · ${names.join(', ')} · ${ensembleName(ens)} · ${stage.hearings} Durchgänge · jede Stimme als Tonfolge eingeben (gebundene Töne einmal)`,
      replays: stage.hearings - 1,
      manualStart: true,
      knowledge: 'dictation:poly',
      async load(p) { await preload(events, p); },
      play() { return play(events); },
      renderAnswer(container, submit) {
        const answers = {};
        parts.forEach((p, i) => {
          const sec = el('div', { class: 'panel' });
          const nNotes = p.notes.filter((n) => n.tie !== 'stop' && n.tie !== 'continue').length;
          sec.appendChild(el('div', { class: 'group-title', text: `${names[i]} · ${nNotes} Töne` }));
          const r = VOICE_RANGE[p.name] || [40, 80];
          const si = sequenceInput(sec, { lo: r[0], hi: r[1], clef: p.name === 'B' || p.name === 'T' ? 'bass' : 'treble', previewInst: insts && insts[i] ? insts[i].inst || insts[i] : 'piano', onSubmit: () => {}, label: 'Töne der Stimme der Reihe nach antippen.' });
          sec.querySelector('.seq-input .row .btn.primary').remove();
          answers[i] = si.seq;
          container.appendChild(sec);
        });
        container.appendChild(el('div', { class: 'row-right' }, el('button', { class: 'btn primary', text: 'Antworten', onclick: () => submit(parts.map((_, i) => answers[i].slice())) })));
      },
      evaluate(answer) {
        let total = 0;
        let hits = 0;
        const marks = [];
        const lines = [];
        parts.forEach((p, i) => {
          const truth = p.notes.filter((n) => n.tie !== 'stop' && n.tie !== 'continue').map((n) => n);
          const match = alignExact(truth.map((n) => n.m), answer[i] || []);
          const h = match.filter((x) => x !== null).length;
          hits += h;
          total += truth.length;
          truth.forEach((n, k) => { if (match[k] === null) marks.push({ part: stage.voices[i], idx: n.idx, color: '#d9534f' }); });
          lines.push(`${names[i]}: ${h} von ${truth.length}`);
        });
        const score = total ? hits / total : 0;
        return {
          score,
          correct: score >= 0.999,
          truthKey: parts.length + 'st',
          answerKey: score >= 0.8 ? 'gut' : score >= 0.5 ? 'teils' : 'schwach',
          truthLabel: lines.join(' · '),
          answerLabel: `${hits} von ${total} Tönen richtig`,
          marks,
          renderFeedbackScore(container) {
            const box = el('div', { class: 'score-box' });
            container.appendChild(box);
            renderExcerpt(box, ex, { parts: stage.voices, marks, maxWidth: Math.min(container.clientWidth || 900, 1100) });
          },
          playTruth: () => play(events),
          playAnswer: null,
          truthPlayLabel: 'Original',
        };
      },
    };
  },
};

export const SKILLS = [melSkill, twelveSkill, polySkill];
