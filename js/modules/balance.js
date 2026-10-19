// Modul Balance: Akkordbalance und Oktaven (Pegelabweichung einer Stimme von der Referenzbalance).
import { CHORD_BY_ID, voiceChord, chordSymbol, chordNameDe } from '../theory/chords.js';
import { pick, randInt, midiToHelmholtz } from '../theory/pitch.js';
import { ensembleName } from '../audio/ensembles.js';
import { chordEvents, preload, play, answerGrid, multiAnswer, fmtDb, el } from './common.js';

/** Referenzbalance in dB je Akkordton (von unten nach oben leiser; Funktion als zweites Kriterium). */
function referenceGains(members, midis) {
  const n = midis.length;
  return members.map((mem, i) => {
    let g = -2.5 * i; // von unten nach oben leiser
    if (mem === 'Grundton') g += 1.5;
    if (mem === 'Septime' || mem === 'None' || mem === 'Undezime' || mem === 'Tredezime' || mem === 'Sexte') g -= 1.5;
    if (mem === 'Terz') g -= 0.5;
    return g;
  }).map((g) => g + 2.5 * (n - 1) / 2); // mittig um 0 dB
}

const chordStages = [
  { diff: 8, label: '9 dB, Dreiklänge, Klavier und Streicher', db: 9, types: ['maj', 'min'], ens: ['piano', 'strings', 'organ'], dur: 3, nVoices: [3, 4] },
  { diff: 20, label: '6 dB, Septakkorde, homogener Satz', db: 6, types: ['maj', 'min', 'dom7', 'maj7', 'm7'], ens: ['strings', 'woodwinds', 'brass', 'organ', 'choir'], dur: 3, nVoices: [4, 4] },
  { diff: 32, label: '4,5 dB, gemischte Farben', db: 4.5, types: ['maj', 'min', 'dom7', 'maj7', 'm7', 'm7b5'], ens: ['strings', 'woodwinds', 'brass', 'mixed', 'choir'], dur: 3, nVoices: [4, 5] },
  { diff: 44, label: '3 dB, Erweiterungen', db: 3, types: ['dom7', 'maj7', 'm7', 'dom9', 'maj9', 'm9'], ens: ['mixed', 'strings', 'brass', 'choir', 'organ'], dur: 3, nVoices: [4, 5] },
  { diff: 56, label: '3 dB, Orchestersatz, kürzer', db: 3, types: ['maj', 'min', 'dom7', 'maj7', 'dom9', 'maj9', 'dom13'], ens: ['orchestra', 'mixed', 'brass'], dur: 1.5, nVoices: [4, 6] },
];

const chordBalance = {
  id: 'bal_chord',
  name: 'Balance: Akkord',
  family: 'balance',
  stages: chordStages,
  itemSeconds: 12,
  dailyMin: 15,
  dailyMax: 30,
  importance: 1.1,
  generate(stageIndex) {
    const stage = chordStages[stageIndex];
    const type = CHORD_BY_ID[pick(stage.types)];
    const root = randInt(0, 11);
    const flats = [5, 10, 3, 8, 1].includes(root);
    const nVoices = randInt(stage.nVoices[0], Math.max(stage.nVoices[0], stage.nVoices[1]));
    const v = voiceChord(type, root, { inversion: 0, spacing: pick(['close', 'open']), bassTarget: randInt(40, 52), nVoices: Math.max(nVoices, type.iv.length), lo: 30, hi: 92 });
    const ref = referenceGains(v.members, v.midis);
    const gains = ref.slice();
    const hasDev = Math.random() > 0.15;
    let devIdx = -1;
    let devDir = 0;
    if (hasDev) {
      devIdx = randInt(0, v.midis.length - 1);
      devDir = Math.random() < 0.5 ? 1 : -1;
      gains[devIdx] += devDir * stage.db;
    }
    const ens = pick(stage.ens);
    const events = chordEvents(v.midis, ens, { dur: stage.dur, gains });
    const eventsRef = chordEvents(v.midis, ens, { dur: stage.dur, gains: ref });
    const voiceLabels = v.midis.map((m, i) => `${['tiefste', '2.', '3.', '4.', '5.', '6.'][i]} Stimme: ${v.members[i]} (${midiToHelmholtz(m, { flats })})`);
    const opts = v.midis.map((m, i) => ({ key: String(i), label: `${v.members[i]}`, sub: midiToHelmholtz(m, { flats }) + (i === 0 ? ' · unten' : i === v.midis.length - 1 ? ' · oben' : '') }));
    const truthKey = hasDev ? `${devIdx}:${devDir > 0 ? 'laut' : 'leise'}` : 'none';
    return {
      skill: 'bal_chord',
      stageIndex,
      diff: stage.diff + (v.midis.length - 4) * 3,
      title: 'Balance: Akkord',
      hint: `${chordNameDe(type, root, { flats })} (${chordSymbol(type, root, { flats })}), ${v.midis.length} Stimmen · ${ensembleName(ens)} · Welche Stimme weicht von der Referenzbalance ab?`,
      replays: stageIndex < 2 ? 1 : 0,
      knowledge: 'balance:chord',
      async load(p) { await preload([...events, ...eventsRef], p); },
      play() { return play(events); },
      renderAnswer(container, submit) {
        multiAnswer(container, [
          { id: 'voice', title: 'Stimme (von unten nach oben)', options: [...opts, { key: 'none', label: 'ausgewogen', sub: 'keine Abweichung' }], columns: 3 },
          { id: 'dir', title: 'Richtung', options: [{ key: 'laut', label: 'zu laut' }, { key: 'leise', label: 'zu leise' }, { key: 'x', label: '(entfällt)' }], columns: 3 },
        ], (a) => submit(a.voice === 'none' ? 'none' : `${a.voice}:${a.dir}`));
      },
      evaluate(answer) {
        let score = 0;
        if (answer === truthKey) score = 1;
        else if (hasDev && answer.split(':')[0] === String(devIdx)) score = 0.5;
        const [ai, ad] = answer.split(':');
        return {
          score,
          correct: score === 1,
          truthKey: hasDev ? (devDir > 0 ? 'laut' : 'leise') + ':' + v.members[devIdx] : 'none',
          answerKey: answer === 'none' ? 'none' : ad + ':' + (v.members[Number(ai)] || '?'),
          truthLabel: hasDev ? `${voiceLabels[devIdx]} war ${fmtDb(devDir * stage.db)} ${devDir > 0 ? 'zu laut' : 'zu leise'}` : 'ausgewogen (Referenzbalance)',
          answerLabel: answer === 'none' ? 'ausgewogen' : `${voiceLabels[Number(ai)] || '?'} ${ad === 'laut' ? 'zu laut' : 'zu leise'}`,
          falseAlarm: !hasDev && answer !== 'none',
          playTruth: () => play(eventsRef),
          playAnswer: () => play(events),
          truthPlayLabel: 'Referenzbalance',
          answerPlayLabel: 'gespielte Fassung',
        };
      },
    };
  },
};

const octStages = [
  { diff: 6, label: '9 dB, Klavier und Orgel', db: 9, ens: ['piano', 'organ', 'strings'], dur: 2.5 },
  { diff: 18, label: '6 dB, homogener Satz', db: 6, ens: ['strings', 'woodwinds', 'brass', 'choir'], dur: 2.5 },
  { diff: 30, label: '4,5 dB, gemischt', db: 4.5, ens: ['mixed', 'strings', 'brass', 'woodwinds'], dur: 2.5 },
  { diff: 42, label: '3 dB, alle, kürzer', db: 3, ens: ['mixed', 'orchestra', 'strings', 'brass', 'choir'], dur: 1.5 },
];

const octaveBalance = {
  id: 'bal_octave',
  name: 'Balance: Oktaven',
  family: 'balance',
  stages: octStages,
  itemSeconds: 9,
  dailyMin: 12,
  dailyMax: 24,
  importance: 0.8,
  generate(stageIndex) {
    const stage = octStages[stageIndex];
    const lower = randInt(40, 60);
    const midis = [lower, lower + 12];
    if (Math.random() < 0.3) midis.push(lower + 24);
    const ref = midis.map((_, i) => (i === 0 ? 1.5 : i === 1 ? -1.5 : -3));
    const gains = ref.slice();
    const hasDev = Math.random() > 0.15;
    let devIdx = -1;
    let devDir = 0;
    if (hasDev) {
      devIdx = randInt(0, midis.length - 1);
      devDir = Math.random() < 0.5 ? 1 : -1;
      gains[devIdx] += devDir * stage.db;
    }
    const ens = pick(stage.ens);
    const events = chordEvents(midis, ens, { dur: stage.dur, gains });
    const eventsRef = chordEvents(midis, ens, { dur: stage.dur, gains: ref });
    const names = midis.length === 2 ? ['Unteroktave', 'Oberoktave'] : ['unterste Oktave', 'mittlere Oktave', 'oberste Oktave'];
    const truthKey = hasDev ? `${devIdx}:${devDir > 0 ? 'laut' : 'leise'}` : 'none';
    const opts = [];
    names.forEach((n, i) => { opts.push({ key: `${i}:laut`, label: n + ' zu laut' }); opts.push({ key: `${i}:leise`, label: n + ' zu leise' }); });
    opts.push({ key: 'none', label: 'ausgewogen', sub: 'Unteroktave trägt' });
    return {
      skill: 'bal_octave',
      stageIndex,
      diff: stage.diff + (midis.length - 2) * 4,
      title: 'Balance: Oktaven',
      hint: `${midis.map((m) => midiToHelmholtz(m)).join(' – ')} · ${ensembleName(ens)} · Referenz: Unteroktave etwas stärker`,
      replays: stageIndex < 2 ? 1 : 0,
      knowledge: 'balance:octave',
      async load(p) { await preload([...events, ...eventsRef], p); },
      play() { return play(events); },
      renderAnswer(container, submit) {
        answerGrid(container, opts, (key) => submit(key), { columns: 2 });
      },
      evaluate(answer) {
        const score = answer === truthKey ? 1 : hasDev && answer.split(':')[0] === String(devIdx) ? 0.5 : 0;
        return {
          score,
          correct: score === 1,
          truthKey: truthKey === 'none' ? 'none' : names[devIdx] + ':' + (devDir > 0 ? 'laut' : 'leise'),
          answerKey: answer === 'none' ? 'none' : (names[Number(answer.split(':')[0])] || '?') + ':' + answer.split(':')[1],
          truthLabel: hasDev ? `${names[devIdx]} ${fmtDb(devDir * stage.db)} ${devDir > 0 ? 'zu laut' : 'zu leise'}` : 'ausgewogen',
          answerLabel: opts.find((o) => o.key === answer)?.label || answer,
          falseAlarm: !hasDev && answer !== 'none',
          playTruth: () => play(eventsRef),
          playAnswer: () => play(events),
          truthPlayLabel: 'Referenzbalance',
          answerPlayLabel: 'gespielte Fassung',
        };
      },
    };
  },
};

export const SKILLS = [chordBalance, octaveBalance];
export { el };
