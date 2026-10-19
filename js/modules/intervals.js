// Modul Intervalle: melodisch, harmonisch, tiefes Register, Intervallketten.
import { INTERVALS } from '../theory/intervals.js';
import { pick, randInt, midiToHelmholtz, pcName } from '../theory/pitch.js';
import { assignVoices, soloInstrument, ensembleName } from '../audio/ensembles.js';
import { chordEvents, progressionEvents, cadenceChords, preload, play, answerGrid, multiAnswer, el, REGISTER_DE } from './common.js';

const E_PIANO = ['piano'];
const E_HOMO = ['strings', 'woodwinds', 'brass'];
const E_MIXED = ['strings', 'woodwinds', 'brass', 'mixed'];
const E_ALL = ['piano', 'strings', 'woodwinds', 'brass', 'mixed', 'choir', 'organ'];

function stagesFor(kind) {
  // kind: 'mel' | 'harm' | 'low'
  const base = [
    { diff: 4, label: 'Oktave, nackt, Klavier', max: 12, ctx: ['none'], reg: ['mid'], ens: E_PIANO, dur: 2.0, art: 'sus' },
    { diff: 14, label: 'Oktave, homogener Satz', max: 12, ctx: ['none'], reg: ['mid'], ens: E_HOMO, dur: 2.0, art: 'sus' },
    { diff: 24, label: 'tonal eingebettet', max: 12, ctx: ['none', 'tonal'], reg: ['mid'], ens: E_HOMO, dur: 2.0, art: 'sus' },
    { diff: 34, label: 'bis Doppeloktave', max: 24, ctx: ['none', 'tonal'], reg: ['mid'], ens: E_HOMO, dur: 2.0, art: 'sus' },
    { diff: 46, label: 'hohes Register, gemischt, 1 s', max: 24, ctx: ['none', 'tonal'], reg: ['mid', 'high'], ens: E_MIXED, dur: 1.0, art: 'sus' },
    { diff: 58, label: 'atonal eingebettet, Chor, Orgel', max: 24, ctx: ['none', 'tonal', 'atonal'], reg: ['mid', 'high'], ens: E_ALL, dur: 1.0, art: 'sus' },
    { diff: 70, label: 'kurz und staccato', max: 24, ctx: ['none', 'tonal', 'atonal'], reg: ['mid', 'high'], ens: E_ALL, dur: 0.4, art: 'stac' },
    { diff: 84, label: 'alles gemischt, Zeitlimit', max: 24, ctx: ['none', 'tonal', 'atonal'], reg: ['mid', 'high'], ens: E_ALL, dur: 0.4, art: 'stac', timeLimit: 3 },
    { diff: 94, label: 'über zwei Oktaven hinaus, bis zum Klavierumfang', max: 60, compound: true, ctx: ['none'], reg: ['all'], ens: ['piano', 'organ', 'sine'], dur: 1.5, art: 'sus' },
  ];
  if (kind === 'low') return base.filter((s) => !s.compound).map((s) => ({ ...s, reg: ['low'], diff: s.diff + 4 }));
  return base;
}

function labelOptions(max) {
  return INTERVALS.filter((iv) => iv.semi <= max).map((iv) => ({ key: iv.abbr, label: iv.abbr, sub: iv.name }));
}

function makeInterval(kind, stage, { focus } = {}) {
  const max = stage.max;
  let semi = randInt(0, max);
  if (focus && Math.random() < 0.6) {
    const f = pick(focus);
    const iv = INTERVALS.find((x) => x.abbr === f.truth || x.abbr === f.answer);
    if (iv && iv.semi <= max) semi = iv.semi;
  }
  const ctx = pick(stage.ctx);
  const reg = pick(stage.reg);
  const ens = pick(stage.ens);
  if (stage.compound) {
    semi = randInt(13, stage.max);
    const loMin = ens === 'organ' ? 24 : 21;
    const hiMax = ens === 'organ' ? 96 : 108;
    const lower = randInt(loMin, hiMax - semi);
    const upper = lower + semi;
    const up = Math.random() < 0.5;
    return { semi, ctx: 'none', reg: 'all', ens, lower, upper, first: kind === 'mel' ? (up ? lower : upper) : lower, second: kind === 'mel' ? (up ? upper : lower) : upper, up, key: null };
  }
  let lo;
  switch (reg) {
    case 'low': lo = randInt(26, 40); break;
    case 'high': lo = randInt(72, 84); break;
    default: lo = randInt(46, 66);
  }
  let up = Math.random() < 0.5;
  // tonaler Kontext: Tonart wählen und Töne diatonisch machen
  let key = null;
  let lower = lo;
  if (ctx === 'tonal') {
    key = randInt(0, 11);
    const scale = [0, 2, 4, 5, 7, 9, 11].map((s) => (key + s) % 12);
    // unteren Ton diatonisch wählen und oberen so, dass beide in der Leiter liegen (mit Toleranz: 60 % diatonisch)
    const cand = [];
    for (let m = lo - 3; m <= lo + 3; m++) if (scale.includes(((m % 12) + 12) % 12) && scale.includes((((m + semi) % 12) + 12) % 12)) cand.push(m);
    if (cand.length) lower = pick(cand);
  }
  const upper = lower + semi;
  const first = kind === 'mel' ? (up ? lower : upper) : lower;
  const second = kind === 'mel' ? (up ? upper : lower) : upper;
  return { semi, ctx, reg, ens, lower, upper, first, second, up, key };
}

function buildEvents(kind, stage, it) {
  const ev = [];
  let t = 0;
  const dur = stage.dur;
  const art = stage.art;
  if (it.ctx === 'tonal') {
    const cad = cadenceChords(it.key, { bassTarget: Math.max(36, Math.min(55, it.lower - 10)) });
    ev.push(...progressionEvents(cad, it.ens, { art: 'sus' }));
    t = cad.reduce((s, c) => s + c.dur + 0.05, 0) + 0.5;
  } else if (it.ctx === 'atonal') {
    const inst = soloInstrument(it.ens, it.lower - 6, it.upper + 6);
    for (let i = 0; i < 3; i++) {
      ev.push({ inst, art: 'sus', midi: it.lower + randInt(-7, 7), t, dur: 0.45, gainDb: -3 });
      t += 0.5;
    }
    t += 0.5;
  }
  if (kind === 'mel') {
    const inst = soloInstrument(it.ens, Math.min(it.lower, it.upper), Math.max(it.lower, it.upper));
    ev.push({ inst, art, midi: it.first, t, dur });
    ev.push({ inst, art, midi: it.second, t: t + dur + 0.08, dur });
  } else {
    ev.push(...chordEvents(it.semi === 0 ? [it.lower] : [it.lower, it.upper], it.ens, { art, dur, t }));
  }
  return ev;
}

function makeSkill(id, name, kind) {
  const stages = stagesFor(kind);
  return {
    id,
    name,
    family: 'intervals',
    stages,
    itemSeconds: 9,
    dailyMin: 25,
    dailyMax: 40,
    importance: 1,
    generate(stageIndex, ctx = {}) {
      const stage = stages[stageIndex];
      const it = makeInterval(kind === 'low' ? pick(['mel', 'harm']) : kind, stage, ctx);
      const playKind = kind === 'low' ? (it.first === it.lower && it.second === it.upper && Math.random() < 0.5 ? 'harm' : 'mel') : kind;
      const events = buildEvents(playKind, stage, it);
      const truth = INTERVALS[it.semi] ? INTERVALS[it.semi].abbr : it.semi + 'st';
      const item = {
        skill: id,
        stageIndex,
        diff: stage.diff + (it.ctx === 'atonal' ? 3 : 0) + (it.semi > 12 ? 2 : 0),
        title: playKind === 'mel' ? 'Melodisches Intervall' : 'Harmonisches Intervall',
        hint: `${ensembleName(it.ens)} · ${REGISTER_DE[it.reg]}${it.ctx === 'tonal' ? ' · nach Kadenz in ' + pcName(it.key) + '-Dur' : it.ctx === 'atonal' ? ' · nach drei Zufallstönen' : ''}`,
        replays: stage.timeLimit ? 0 : stageIndex < 4 ? 1 : 0,
        timeLimit: stage.timeLimit || 0,
        knowledge: INTERVALS[it.semi] ? 'interval:' + truth : 'interval:r15',
        async load(p) { await preload(events, p); },
        play() { return play(events); },
        renderAnswer(container, submit) {
          if (stage.compound) {
            multiAnswer(container, [
              { id: 'oct', title: 'Oktaven', options: [1, 2, 3, 4, 5].map((o) => ({ key: String(o), label: o + (o === 1 ? ' Oktave' : ' Oktaven') })), columns: 5 },
              { id: 'rest', title: 'plus', options: INTERVALS.slice(0, 12).map((iv) => ({ key: iv.abbr, label: iv.abbr, sub: iv.name })), columns: 6 },
            ], (a) => submit(a));
            return;
          }
          answerGrid(container, labelOptions(stage.max), (key) => submit(key), { columns: stage.max > 12 ? 5 : 4 });
        },
        evaluate(answer) {
          if (stage.compound) {
            const oct = Math.floor(it.semi / 12);
            const rest = INTERVALS[it.semi % 12].abbr;
            const octOk = String(oct) === answer.oct;
            const restOk = rest === answer.rest;
            const score = (octOk ? 0.5 : 0) + (restOk ? 0.5 : 0);
            const restName = INTERVALS.find((x) => x.abbr === answer.rest)?.name || answer.rest;
            return {
              score,
              correct: score === 1,
              truthKey: oct + '+' + rest,
              answerKey: answer.oct + '+' + answer.rest,
              truthLabel: `${oct} ${oct === 1 ? 'Oktave' : 'Oktaven'} + ${INTERVALS[it.semi % 12].name} (${midiToHelmholtz(it.lower)} – ${midiToHelmholtz(it.upper)}, ${it.semi} Halbtöne)`,
              answerLabel: `${answer.oct} ${answer.oct === '1' ? 'Oktave' : 'Oktaven'} + ${restName}`,
              playTruth: () => play(buildEvents(playKind, stage, it)),
              playAnswer: null,
            };
          }
          const correct = answer === truth;
          const t = INTERVALS[it.semi];
          const a = INTERVALS.find((x) => x.abbr === answer);
          return {
            score: correct ? 1 : 0,
            correct,
            truthKey: truth,
            answerKey: answer,
            truthLabel: `${t.name} (${midiToHelmholtz(it.lower)} – ${midiToHelmholtz(it.upper)})`,
            answerLabel: a ? a.name : answer,
            playTruth: () => play(buildEvents(playKind, stage, it)),
            playAnswer: a
              ? () => play(buildEvents(playKind, stage, { ...it, semi: a.semi, upper: it.lower + a.semi, first: playKind === 'mel' ? (it.up ? it.lower : it.lower + a.semi) : it.lower, second: playKind === 'mel' ? (it.up ? it.lower + a.semi : it.lower) : it.lower + a.semi, ctx: 'none' }))
              : null,
          };
        },
      };
      return item;
    },
  };
}

// Intervallketten: 3 bis 5 Töne, alle Intervalle benennen
const chainStages = [
  { diff: 30, label: '3 Töne, bis Oktave, Klavier', n: 3, max: 12, ens: E_PIANO, dur: 0.9 },
  { diff: 42, label: '4 Töne, homogener Satz', n: 4, max: 12, ens: E_HOMO, dur: 0.8 },
  { diff: 54, label: '4 Töne, bis None, gemischt', n: 4, max: 14, ens: E_MIXED, dur: 0.7 },
  { diff: 66, label: '5 Töne, bis Dezime', n: 5, max: 16, ens: E_ALL, dur: 0.6 },
  { diff: 80, label: '5 Töne, schnell', n: 5, max: 16, ens: E_ALL, dur: 0.4 },
];

const chainSkill = {
  id: 'int_chain',
  name: 'Intervallketten',
  family: 'intervals',
  stages: chainStages,
  itemSeconds: 18,
  dailyMin: 12,
  dailyMax: 20,
  importance: 0.8,
  generate(stageIndex) {
    const stage = chainStages[stageIndex];
    const ens = pick(stage.ens);
    const start = randInt(50, 66);
    const midis = [start];
    const semis = [];
    for (let i = 1; i < stage.n; i++) {
      let s = randInt(1, stage.max);
      const dir = Math.random() < 0.5 ? 1 : -1;
      let m = midis[i - 1] + dir * s;
      if (m < 40 || m > 84) m = midis[i - 1] - dir * s;
      midis.push(m);
      semis.push(Math.abs(m - midis[i - 1]));
    }
    const inst = soloInstrument(ens, Math.min(...midis), Math.max(...midis));
    const events = midis.map((m, i) => ({ inst, art: 'sus', midi: m, t: i * (stage.dur + 0.06), dur: stage.dur }));
    const truth = semis.map((s) => INTERVALS[s].abbr);
    return {
      skill: 'int_chain',
      stageIndex,
      diff: stage.diff,
      title: 'Intervallkette',
      hint: `${stage.n} Töne · ${ensembleName(ens)} · jedes Intervall der Reihe nach benennen`,
      replays: stageIndex < 2 ? 1 : 0,
      knowledge: 'interval:chain',
      async load(p) { await preload(events, p); },
      play() { return play(events); },
      renderAnswer(container, submit) {
        const groups = semis.map((_, i) => ({ id: 'i' + i, title: `Intervall ${i + 1}`, options: labelOptions(stage.max).map((o) => ({ key: o.key, label: o.key })), columns: 8 }));
        multiAnswer(container, groups, (ans) => submit(semis.map((_, i) => ans['i' + i])));
      },
      evaluate(answer) {
        let hits = 0;
        answer.forEach((a, i) => { if (a === truth[i]) hits++; });
        const score = hits / truth.length;
        return {
          score,
          correct: score === 1,
          truthKey: truth.join(' '),
          answerKey: answer.join(' '),
          truthLabel: truth.join(' · ') + ' (' + midis.map((m) => midiToHelmholtz(m)).join(' ') + ')',
          answerLabel: answer.join(' · '),
          playTruth: () => play(events),
          playAnswer: null,
        };
      },
    };
  },
};

export const SKILLS = [
  makeSkill('int_mel', 'Intervalle melodisch', 'mel'),
  makeSkill('int_harm', 'Intervalle harmonisch', 'harm'),
  makeSkill('int_low', 'Intervalle im tiefen Register', 'low'),
  chainSkill,
];

export { assignVoices, el };
