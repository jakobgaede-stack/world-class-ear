// Modul Akkorde: Dreiklänge, Septakkorde, Erweiterungen, Quart-/Quintklänge, Sekundklänge, Polyakkorde, Setklassen.
import { CHORD_TYPES, CHORD_BY_ID, INVERSION_DE, chordSymbol, chordNameDe, voiceChord, voicePolychord, typesFor } from '../theory/chords.js';
import { FORTE, TRICHORD_INFO, primeForm, forteName, realize, pfLabel, intervalVector } from '../theory/setclass.js';
import { pick, randInt, pcName, pcNameEn, midiToHelmholtz, shuffle } from '../theory/pitch.js';
import { ensembleName } from '../audio/ensembles.js';
import { chordEvents, preload, play, playChord, answerGrid, multiAnswer, el, randomRegisterBass, REGISTER_DE } from './common.js';

const E_PIANO = ['piano'];
const E_HOMO = ['strings', 'woodwinds', 'brass'];
const E_MIXED = ['strings', 'woodwinds', 'brass', 'mixed'];
const E_ALL = ['piano', 'strings', 'woodwinds', 'brass', 'mixed', 'choir', 'organ'];
const E_ORCH = ['mixed', 'orchestra', 'brass', 'strings'];

/**
 * Stufe: { diff, label, types (ids) , askInv (bool), spacing[], reg[], ens[], dur, art, nVoices (max Verdopplungen), omitRoot }
 */
const DEF = {
  ch_triads: {
    name: 'Dreiklänge',
    stages: [
      { diff: 4, label: 'Grundstellung, eng, Klavier', types: ['maj', 'min', 'dim', 'aug'], askInv: false, spacing: ['close'], reg: ['mid'], ens: E_PIANO, dur: 3, art: 'sus' },
      { diff: 14, label: 'mit Umkehrungen', types: ['maj', 'min', 'dim', 'aug'], askInv: true, spacing: ['close'], reg: ['mid'], ens: E_PIANO, dur: 3, art: 'sus' },
      { diff: 24, label: 'sus-Akkorde, weite Lage, homogener Satz', types: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'], askInv: true, spacing: ['close', 'open'], reg: ['mid'], ens: E_HOMO, dur: 3, art: 'sus' },
      { diff: 34, label: 'Verdopplungen, alle Register, gemischt', types: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'], askInv: true, spacing: ['open', 'wide'], reg: ['mid', 'high', 'low'], ens: E_MIXED, dur: 2, art: 'sus', nVoices: 5 },
      { diff: 46, label: 'kurz (1 s), Chor und Orgel', types: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'], askInv: true, spacing: ['close', 'open', 'wide'], reg: ['mid', 'high', 'low'], ens: E_ALL, dur: 1, art: 'sus', nVoices: 5 },
      { diff: 58, label: 'staccato, Orchestersatz', types: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'], askInv: true, spacing: ['open', 'wide'], reg: ['all'], ens: E_ORCH, dur: 0.5, art: 'stac', nVoices: 6 },
    ],
  },
  ch_sevenths: {
    name: 'Septakkorde',
    stages: [
      { diff: 10, label: 'sieben Grundtypen, Grundstellung, Klavier', types: ['dim7', 'm7b5', 'm7', 'mMaj7', 'dom7', 'maj7', 'augMaj7'], askInv: false, spacing: ['close'], reg: ['mid'], ens: E_PIANO, dur: 3, art: 'sus' },
      { diff: 20, label: 'mit Umkehrungen', types: ['dim7', 'm7b5', 'm7', 'mMaj7', 'dom7', 'maj7', 'augMaj7'], askInv: true, spacing: ['close'], reg: ['mid'], ens: E_PIANO, dur: 3, art: 'sus' },
      { diff: 30, label: 'Drop 2 und weite Lage, homogener Satz', types: ['dim7', 'm7b5', 'm7', 'mMaj7', 'dom7', 'maj7', 'augMaj7'], askInv: true, spacing: ['close', 'drop2', 'open'], reg: ['mid'], ens: E_HOMO, dur: 3, art: 'sus' },
      { diff: 40, label: 'alterierte Typen, gemischte Farben', types: ['dim7', 'm7b5', 'm7', 'mMaj7', 'dom7', 'maj7', 'augMaj7', 'aug7', '7b5', 'maj7b5', '7sus4', 'dimMaj7', '6', 'm6'], askInv: true, spacing: ['close', 'drop2', 'open'], reg: ['mid', 'high'], ens: E_MIXED, dur: 2.5, art: 'sus' },
      { diff: 52, label: 'weite Lage, alle Register, 1,5 s', types: ['dim7', 'm7b5', 'm7', 'mMaj7', 'dom7', 'maj7', 'augMaj7', 'aug7', '7b5', 'maj7b5', '7sus4', 'dimMaj7', '6', 'm6'], askInv: true, spacing: ['open', 'wide'], reg: ['mid', 'high', 'low'], ens: E_ALL, dur: 1.5, art: 'sus', nVoices: 5 },
      { diff: 64, label: 'kurz, Orchestersatz', types: ['dim7', 'm7b5', 'm7', 'mMaj7', 'dom7', 'maj7', 'augMaj7', 'aug7', '7b5', 'maj7b5', '7sus4', 'dimMaj7', '6', 'm6'], askInv: true, spacing: ['open', 'wide'], reg: ['all'], ens: E_ORCH, dur: 0.5, art: 'stac', nVoices: 6 },
    ],
  },
  ch_ext: {
    name: 'Erweiterungen (Jazz)',
    stages: [
      { diff: 18, label: 'Nonakkorde, Grundstellung, Klavier', types: ['dom9', 'maj9', 'm9', '7b9', '7#9'], askInv: false, spacing: ['close'], reg: ['mid'], ens: E_PIANO, dur: 3, art: 'sus' },
      { diff: 30, label: 'mit 6/9 und mMaj9, Drop 2, Streicher', types: ['dom9', 'maj9', 'm9', '7b9', '7#9', 'mMaj9', '69', 'm69'], askInv: false, spacing: ['close', 'drop2'], reg: ['mid'], ens: ['piano', 'strings'], dur: 3, art: 'sus' },
      { diff: 42, label: 'Undezimakkorde, gemischt', types: ['dom9', 'maj9', 'm9', '7b9', '7#9', 'mMaj9', '69', 'm69', 'dom11', 'm11', '7#11', 'maj7#11'], askInv: false, spacing: ['close', 'drop2', 'open'], reg: ['mid'], ens: E_MIXED, dur: 3, art: 'sus' },
      { diff: 54, label: 'Tredezimen und alterierte Dominanten, weit', types: ['dom9', 'maj9', 'm9', '7b9', '7#9', 'mMaj9', '69', 'm69', 'dom11', 'm11', '7#11', 'maj7#11', 'dom13', 'maj13', 'm13', '7b13', '7alt'], askInv: false, spacing: ['open', 'wide'], reg: ['mid', 'high'], ens: E_ALL, dur: 2.5, art: 'sus' },
      { diff: 66, label: 'ohne Grundton (rootless), Bassnote benennen', types: ['dom9', 'maj9', 'm9', '7b9', '7#9', 'dom11', 'm11', '7#11', 'maj7#11', 'dom13', 'maj13', 'm13', '7b13', '7alt'], askInv: false, askBass: true, spacing: ['drop2', 'open'], reg: ['mid'], ens: E_ALL, dur: 2.5, art: 'sus', omitRoot: true },
      { diff: 78, label: 'kurz, Orchestersatz', types: ['dom9', 'maj9', 'm9', '7b9', '7#9', 'mMaj9', '69', 'm69', 'dom11', 'm11', '7#11', 'maj7#11', 'dom13', 'maj13', 'm13', '7b13', '7alt'], askInv: false, spacing: ['open', 'wide'], reg: ['all'], ens: E_ORCH, dur: 0.6, art: 'stac' },
    ],
  },
  ch_quartal: {
    name: 'Quart- und Quintklänge',
    stages: [
      { diff: 14, label: 'drei Töne, Klavier', types: ['q3pp', 'q3pa', 'q3ap'], askInv: false, spacing: ['close'], reg: ['mid'], ens: E_PIANO, dur: 3, art: 'sus' },
      { diff: 26, label: 'drei Töne, Umkehrungen, Streicher', types: ['q3pp', 'q3pa', 'q3ap', 's3MM'], askInv: false, spacing: ['close', 'open'], reg: ['mid'], ens: ['piano', 'strings', 'woodwinds'], dur: 3, art: 'sus', rotate: true },
      { diff: 38, label: 'vier Töne und Quintklänge', types: ['q3pp', 'q3pa', 'q3ap', 'q4', 'q4a', 'f3'], askInv: false, spacing: ['close', 'open'], reg: ['mid'], ens: E_HOMO, dur: 3, art: 'sus' },
      { diff: 50, label: 'fünf Töne, So What, Mischklänge, gemischt', types: ['q3pp', 'q3pa', 'q3ap', 'q4', 'q4a', 'q5', 'sowhat', 'f3', 'f4', 'mix34', 'mix43'], askInv: false, spacing: ['close', 'open'], reg: ['mid', 'high'], ens: E_MIXED, dur: 2.5, art: 'sus' },
      { diff: 62, label: 'kurz, Orchestersatz', types: ['q3pp', 'q3pa', 'q3ap', 'q4', 'q4a', 'q5', 'sowhat', 'f3', 'f4', 'mix34', 'mix43'], askInv: false, spacing: ['close', 'open'], reg: ['all'], ens: E_ORCH, dur: 0.6, art: 'stac' },
    ],
  },
  ch_secundal: {
    name: 'Sekundklänge',
    stages: [
      { diff: 16, label: 'vier Typen, Klavier, gehalten', types: ['s3MM', 's3Mm', 's3mM', 's3mm'], askInv: false, spacing: ['close'], reg: ['mid'], ens: E_PIANO, dur: 3, art: 'sus' },
      { diff: 28, label: 'Umkehrungen (in Septimen), Streicher', types: ['s3MM', 's3Mm', 's3mM', 's3mm'], askInv: false, spacing: ['close', 'open'], reg: ['mid'], ens: ['piano', 'strings', 'woodwinds'], dur: 3, art: 'sus', rotate: true },
      { diff: 40, label: 'gemischt, 1,5 s', types: ['s3MM', 's3Mm', 's3mM', 's3mm'], askInv: false, spacing: ['close', 'open'], reg: ['mid', 'high', 'low'], ens: E_MIXED, dur: 1.5, art: 'sus', rotate: true },
      { diff: 52, label: 'kurz, alle Besetzungen', types: ['s3MM', 's3Mm', 's3mM', 's3mm'], askInv: false, spacing: ['close', 'open'], reg: ['all'], ens: E_ALL, dur: 0.6, art: 'stac', rotate: true },
    ],
  },
};

function typeOptions(types, { askSym = true } = {}) {
  return types.map((id) => {
    const t = CHORD_BY_ID[id];
    return { key: id, label: t.sym && t.cat !== 'quartal' && t.cat !== 'secundal' ? (t.sym || 'Dur') : t.de.replace(/\s*\(.*\)/, ''), sub: t.sym && t.cat !== 'quartal' && t.cat !== 'secundal' ? t.de : t.sym };
  });
}

function makeChordSkill(id, def) {
  return {
    id,
    name: def.name,
    family: 'chords',
    stages: def.stages,
    itemSeconds: 12,
    dailyMin: 25,
    dailyMax: 40,
    importance: 1,
    generate(stageIndex, ctx = {}) {
      const stage = def.stages[stageIndex];
      let typeId = pick(stage.types);
      if (ctx.focus && Math.random() < 0.6) {
        const f = pick(ctx.focus);
        if (stage.types.includes(f.truth)) typeId = f.truth;
      }
      const type = CHORD_BY_ID[typeId];
      const root = randInt(0, 11);
      const n = type.iv.length;
      const inversion = stage.askInv || stage.rotate ? randInt(0, Math.min(n - 1, 3)) : 0;
      const spacing = pick(stage.spacing);
      const reg = pick(stage.reg);
      const ens = pick(stage.ens);
      const bassTarget = randomRegisterBass(reg);
      const nVoices = stage.nVoices ? randInt(n, stage.nVoices) : n;
      let v = voiceChord(type, root, { inversion, spacing, bassTarget, nVoices, lo: 26, hi: 96 });
      let midis = v.midis;
      let members = v.members;
      if (stage.omitRoot) {
        const idx = members.indexOf('Grundton');
        if (idx >= 0 && midis.length > 3) { midis = midis.filter((_, i) => i !== idx); members = members.filter((_, i) => i !== idx); }
      }
      const events = chordEvents(midis, ens, { art: stage.art, dur: stage.dur });
      const flats = [5, 10, 3, 8, 1].includes(root);
      const truth = typeId;
      const truthInv = v.inversion;
      const invLabel = INVERSION_DE[truthInv] || ('Umkehrung ' + truthInv);
      const groups = [{ id: 'type', title: 'Akkordtyp', options: typeOptions(stage.types), columns: 0 }];
      if (stage.askInv) groups.push({ id: 'inv', title: 'Umkehrung (tiefster Akkordton)', options: INVERSION_DE.slice(0, n).map((l, i) => ({ key: String(i), label: l })), columns: 4 });
      if (stage.askBass) groups.push({ id: 'bass', title: 'Tiefster Ton', options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => ({ key: String(p), label: pcName(p, { flats: true }) })), columns: 6 });
      const describe = () => `${chordNameDe(type, root, { flats })}${type.cat === 'quartal' || type.cat === 'secundal' ? '' : ' (' + chordSymbol(type, root, { flats }) + ')'}${stage.askInv ? ', ' + invLabel : ''}${stage.rotate ? ', ' + members[0] + ' unten' : ''}`;
      return {
        skill: id,
        stageIndex,
        diff: stage.diff + (truthInv > 0 ? 3 : 0) + (spacing === 'wide' ? 2 : 0) + (reg === 'low' ? 3 : 0),
        title: def.name,
        hint: `${ensembleName(ens)} · ${REGISTER_DE[reg]} · ${spacing === 'close' ? 'enge Lage' : spacing === 'drop2' ? 'Drop 2' : spacing === 'open' ? 'weite Lage' : 'sehr weite Lage'}${stage.omitRoot ? ' · ohne Grundton' : ''}`,
        replays: stageIndex < 3 ? 1 : 0,
        knowledge: 'chord:' + typeId,
        async load(p) { await preload(events, p); },
        play() { return playChord(events, { stageHold: stage.dur >= 2.5 }); },
        renderAnswer(container, submit) {
          if (groups.length === 1) answerGrid(container, groups[0].options, (key) => submit({ type: key }));
          else multiAnswer(container, groups, submit);
        },
        evaluate(answer) {
          const typeOk = answer.type === truth;
          let score = typeOk ? 1 : 0;
          let extra = '';
          if (stage.askInv) {
            const invOk = String(truthInv) === answer.inv;
            score = (typeOk ? 0.7 : 0) + (invOk ? 0.3 : 0);
            extra = invOk ? '' : ' · Umkehrung falsch';
          }
          if (stage.askBass) {
            const bassOk = String(((midis[0] % 12) + 12) % 12) === answer.bass;
            score = (typeOk ? 0.7 : 0) + (bassOk ? 0.3 : 0);
            extra = bassOk ? '' : ' · tiefster Ton falsch';
          }
          const at = CHORD_BY_ID[answer.type];
          return {
            score,
            correct: score >= 0.999,
            truthKey: truth,
            answerKey: answer.type,
            truthLabel: describe() + ' · ' + midis.map((m) => midiToHelmholtz(m, { flats })).join(' '),
            answerLabel: (at ? at.de : answer.type) + (stage.askInv && answer.inv !== undefined ? ', ' + INVERSION_DE[Number(answer.inv)] : '') + extra,
            playTruth: () => play(events),
            playAnswer: at && !typeOk
              ? () => {
                  const av = voiceChord(at, root, { inversion: Math.min(Number(answer.inv || 0), at.iv.length - 1), spacing, bassTarget, nVoices: Math.max(nVoices, at.iv.length), lo: 26, hi: 96 });
                  return play(chordEvents(av.midis, ens, { art: stage.art, dur: stage.dur }));
                }
              : null,
          };
        },
      };
    },
  };
}

// Polyakkorde
const polyStages = [
  { diff: 24, label: 'zwei Durdreiklänge, nahe Grundtöne, Klavier', lower: ['maj'], upper: ['maj'], dists: [2, 5, 7, 10], ens: E_PIANO, dur: 3 },
  { diff: 36, label: 'Dur und Moll, alle Abstände', lower: ['maj', 'min'], upper: ['maj', 'min'], dists: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ens: ['piano', 'strings'], dur: 3 },
  { diff: 48, label: 'Blech unten, Holz oben', lower: ['maj', 'min', 'dim', 'aug'], upper: ['maj', 'min', 'dim', 'aug'], dists: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ens: ['split', 'mixed'], dur: 3 },
  { diff: 60, label: 'Dreiklang über Septakkord', lower: ['dom7', 'maj7', 'm7'], upper: ['maj', 'min', 'aug', 'dim'], dists: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ens: ['piano', 'split', 'mixed'], dur: 2.5 },
  { diff: 72, label: 'kurz, Orchester', lower: ['maj', 'min', 'dom7', 'maj7'], upper: ['maj', 'min', 'aug', 'dim'], dists: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ens: ['orchestra', 'mixed'], dur: 0.7 },
];

const polySkill = {
  id: 'ch_poly',
  name: 'Polyakkorde',
  family: 'chords',
  stages: polyStages,
  itemSeconds: 16,
  dailyMin: 12,
  dailyMax: 24,
  importance: 0.8,
  generate(stageIndex) {
    const stage = polyStages[stageIndex];
    const lt = CHORD_BY_ID[pick(stage.lower)];
    const ut = CHORD_BY_ID[pick(stage.upper)];
    const lowerRoot = randInt(0, 11);
    const dist = pick(stage.dists);
    const upperRoot = (lowerRoot + dist) % 12;
    const v = voicePolychord(lt, lowerRoot, ut, upperRoot, { bassTarget: randInt(40, 48) });
    let ens = pick(stage.ens);
    let events;
    if (ens === 'split') {
      events = [...chordEvents(v.lower.midis, 'brass', { dur: stage.dur }), ...chordEvents(v.upper.midis, 'woodwinds', { dur: stage.dur })];
    } else events = chordEvents(v.midis, ens, { dur: stage.dur, art: stage.dur < 1 ? 'stac' : 'sus' });
    const flats = Math.random() < 0.5;
    const symL = chordSymbol(lt, lowerRoot, { flats });
    const symU = chordSymbol(ut, upperRoot, { flats });
    const truth = symU + '/' + symL;
    const rootOpts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => ({ key: String(p), label: pcNameEn(p, { flats }) }));
    const qualOpts = (list) => [...new Set(list)].map((id) => ({ key: id, label: CHORD_BY_ID[id].sym || 'Dur', sub: CHORD_BY_ID[id].de }));
    return {
      skill: 'ch_poly',
      stageIndex,
      diff: stage.diff + ([1, 6, 11].includes(dist) ? 4 : 0),
      title: 'Polyakkord',
      hint: `${ens === 'split' ? 'Blech unten, Holz oben' : ensembleName(ens)} · zwei Einheiten benennen (oben über unten)`,
      replays: stageIndex < 2 ? 1 : 0,
      knowledge: 'chord:poly',
      async load(p) { await preload(events, p); },
      play() { return playChord(events, { stageHold: stage.dur >= 2.5 }); },
      renderAnswer(container, submit) {
        multiAnswer(container, [
          { id: 'lr', title: 'Untere Einheit: Grundton', options: rootOpts, columns: 6 },
          { id: 'lq', title: 'Untere Einheit: Typ', options: qualOpts(stage.lower), columns: 4 },
          { id: 'ur', title: 'Obere Einheit: Grundton', options: rootOpts, columns: 6 },
          { id: 'uq', title: 'Obere Einheit: Typ', options: qualOpts(stage.upper), columns: 4 },
        ], submit);
      },
      evaluate(a) {
        let score = 0;
        if (a.lr === String(lowerRoot)) score += 0.3;
        if (a.lq === lt.id) score += 0.2;
        if (a.ur === String(upperRoot)) score += 0.3;
        if (a.uq === ut.id) score += 0.2;
        const ansLabel = `${pcNameEn(Number(a.ur), { flats })}${CHORD_BY_ID[a.uq]?.sym ?? ''}/${pcNameEn(Number(a.lr), { flats })}${CHORD_BY_ID[a.lq]?.sym ?? ''}`;
        return {
          score,
          correct: score > 0.999,
          truthKey: 'd' + dist + ':' + lt.id + '+' + ut.id,
          answerKey: 'd' + (((Number(a.ur) - Number(a.lr)) % 12) + 12) % 12 + ':' + a.lq + '+' + a.uq,
          truthLabel: `${truth} (${v.midis.map((m) => midiToHelmholtz(m, { flats })).join(' ')})`,
          answerLabel: ansLabel,
          playTruth: () => play(events),
          playAnswer: null,
        };
      },
    };
  },
};

// Setklassen
const TRI_FAM3 = ['3-10', '3-11', '3-12'];
const TRI_FAM2 = ['3-6', '3-7', '3-8', '3-9'];
const TRI_ALL = FORTE[3].map((x) => x[0]);
const TET_COMMON = ['4-1', '4-3', '4-7', '4-9', '4-10', '4-11', '4-14', '4-17', '4-18', '4-19', '4-20', '4-21', '4-22', '4-23', '4-24', '4-25', '4-26', '4-27', '4-28'];
const TET_ALL = FORTE[4].map((x) => x[0]);
const setStages = [
  { diff: 20, label: 'Trichorde ohne kleine Sekunde (Familien 2 und 3), Klavier', sets: [...TRI_FAM3, ...TRI_FAM2], spread: 'close', ens: E_PIANO, dur: 3 },
  { diff: 32, label: 'alle 12 Trichorde, enge Lage', sets: TRI_ALL, spread: 'close', ens: ['piano', 'strings'], dur: 3 },
  { diff: 44, label: 'Trichorde weit, gemischte Farben', sets: TRI_ALL, spread: 'wide', ens: E_MIXED, dur: 3 },
  { diff: 56, label: 'häufige Tetrachorde', sets: TET_COMMON, spread: 'close', ens: ['piano', 'strings', 'woodwinds'], dur: 3 },
  { diff: 68, label: 'alle 29 Tetrachorde, gemischt', sets: TET_ALL, spread: 'wide', ens: E_MIXED, dur: 2.5 },
  { diff: 80, label: 'kurz, alle Besetzungen', sets: [...TRI_ALL, ...TET_ALL], spread: 'wide', ens: E_ALL, dur: 0.7 },
];

const setSkill = {
  id: 'ch_setclass',
  name: 'Setklassen (Forte)',
  family: 'chords',
  stages: setStages,
  itemSeconds: 14,
  dailyMin: 15,
  dailyMax: 30,
  importance: 0.9,
  generate(stageIndex, ctx = {}) {
    const stage = setStages[stageIndex];
    let name = pick(stage.sets);
    if (ctx.focus && Math.random() < 0.6) {
      const f = pick(ctx.focus);
      if (stage.sets.includes(f.truth)) name = f.truth;
    }
    const card = Number(name[0]);
    const pf = FORTE[card].find((x) => x[0] === name)[1];
    const midis = realize(pf, randInt(0, 11), { bassTarget: randInt(48, 62), spread: stage.spread });
    const ens = pick(stage.ens);
    const events = chordEvents(midis, ens, { dur: stage.dur, art: stage.dur < 1 ? 'stac' : 'sus' });
    const options = stage.sets.map((s) => {
      const f = FORTE[Number(s[0])].find((x) => x[0] === s)[1];
      return { key: s, label: s, sub: pfLabel(f) };
    });
    return {
      skill: 'ch_setclass',
      stageIndex,
      diff: stage.diff,
      title: 'Setklasse',
      hint: `${card === 3 ? 'Trichord' : 'Tetrachord'} · ${ensembleName(ens)} · ${stage.spread === 'close' ? 'enge Lage' : 'weite Lage'}`,
      replays: stageIndex < 2 ? 1 : 0,
      knowledge: 'set:' + name,
      async load(p) { await preload(events, p); },
      play() { return playChord(events, { stageHold: stage.dur >= 2.5 }); },
      renderAnswer(container, submit) {
        answerGrid(container, options, (key) => submit(key), { columns: options.length > 16 ? 6 : 4 });
      },
      evaluate(answer) {
        const correct = answer === name;
        const af = FORTE[Number((answer || '3')[0])]?.find((x) => x[0] === answer);
        return {
          score: correct ? 1 : 0,
          correct,
          truthKey: name,
          answerKey: answer,
          truthLabel: `${name} ${pfLabel(pf)}${TRICHORD_INFO[name] ? ' · ' + TRICHORD_INFO[name].name : ''} · Töne ${midis.map((m) => midiToHelmholtz(m)).join(' ')} · Intervallvektor ${intervalVector(midis).join('')}`,
          answerLabel: af ? `${answer} ${pfLabel(af[1])}` : answer,
          playTruth: () => play(events),
          playAnswer: af ? () => play(chordEvents(realize(af[1], midis[0] % 12, { bassTarget: midis[0], spread: 'close' }), ens, { dur: stage.dur })) : null,
        };
      },
    };
  },
};

export const SKILLS = [
  makeChordSkill('ch_triads', DEF.ch_triads),
  makeChordSkill('ch_sevenths', DEF.ch_sevenths),
  makeChordSkill('ch_ext', DEF.ch_ext),
  makeChordSkill('ch_quartal', DEF.ch_quartal),
  makeChordSkill('ch_secundal', DEF.ch_secundal),
  polySkill,
  setSkill,
];
