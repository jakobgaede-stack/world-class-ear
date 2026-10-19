// Modul Cluster: Aufbau Ton für Ton, später als Zusammenklang; Antwort auf dem Bildschirmklavier.
import { makeCluster, majorScalePcs } from '../theory/chords.js';
import { pick, randInt, midiToHelmholtz, pcName } from '../theory/pitch.js';
import { ensembleName } from '../audio/ensembles.js';
import { chordEvents, preload, play, playChord, el } from './common.js';
import { keyboard } from '../ui/keyboard.js';

const stages = [
  { diff: 14, label: 'Aufbau Ton für Ton, diatonisch, 3 bis 4 Töne, Klavier', mode: 'build', diatonic: true, n: [3, 4], ens: ['piano'], dur: 1.2 },
  { diff: 26, label: 'Aufbau, chromatisch, 3 bis 5 Töne', mode: 'build', diatonic: false, n: [3, 5], ens: ['piano', 'strings'], dur: 1.0 },
  { diff: 38, label: 'Zusammenklang, diatonisch, 3 bis 4 Töne', mode: 'sim', diatonic: true, n: [3, 4], ens: ['piano', 'strings', 'woodwinds'], dur: 3 },
  { diff: 50, label: 'Zusammenklang, chromatisch, 3 bis 5 Töne', mode: 'sim', diatonic: false, n: [3, 5], ens: ['piano', 'strings', 'woodwinds', 'brass'], dur: 3 },
  { diff: 62, label: 'Zusammenklang, 5 bis 8 Töne, gemischt', mode: 'sim', diatonic: null, n: [5, 8], ens: ['mixed', 'strings', 'organ', 'choir'], dur: 3 },
  { diff: 74, label: 'kurz, Orchestersatz', mode: 'sim', diatonic: null, n: [4, 8], ens: ['orchestra', 'mixed'], dur: 0.8 },
];

export const SKILLS = [
  {
    id: 'ch_cluster',
    name: 'Cluster',
    family: 'chords',
    stages,
    itemSeconds: 20,
    dailyMin: 10,
    dailyMax: 20,
    importance: 0.8,
    generate(stageIndex) {
      const stage = stages[stageIndex];
      const n = randInt(stage.n[0], stage.n[1]);
      const diatonic = stage.diatonic === null ? Math.random() < 0.5 : stage.diatonic;
      const start = randInt(52, 66);
      const scale = diatonic ? majorScalePcs(randInt(0, 11)) : null;
      const midis = makeCluster(start, n, { diatonic: scale });
      const ens = pick(stage.ens);
      let events;
      if (stage.mode === 'build') {
        events = [];
        midis.forEach((m, i) => {
          const sub = midis.slice(0, i + 1);
          events.push(...chordEvents(sub, ens, { dur: stage.dur, t: i * (stage.dur + 0.15) }));
        });
        events.push(...chordEvents(midis, ens, { dur: 2.5, t: n * (stage.dur + 0.15) + 0.3 }));
      } else {
        events = chordEvents(midis, ens, { dur: stage.dur, art: stage.dur < 1 ? 'stac' : 'sus' });
      }
      const lo = start - 4;
      const hi = Math.max(...midis) + 5;
      return {
        skill: 'ch_cluster',
        stageIndex,
        diff: stage.diff + (n - 3) * 2,
        title: stage.mode === 'build' ? 'Cluster, Aufbau' : 'Cluster, Zusammenklang',
        hint: `${ensembleName(ens)} · ${diatonic ? 'diatonisch' : 'chromatisch'} · tiefster Ton ${midiToHelmholtz(start)} ist vorgegeben${stage.mode === 'sim' ? ' · Anzahl und Töne bestimmen' : ''}`,
        replays: stageIndex < 2 ? 1 : 0,
        knowledge: 'chord:cluster',
        async load(p) { await preload(events, p); },
        play() { return stage.mode === 'sim' && stage.dur >= 2.5 ? playChord(events, { stageHold: true }) : play(events); },
        renderAnswer(container, submit) {
          const sel = new Set([start]);
          const kb = keyboard(container, { lo, hi, selected: sel, fixed: new Set([start]), onChange: () => {} });
          const info = el('div', { class: 'muted small', text: 'Töne antippen, dann antworten.' });
          const btn = el('button', { class: 'btn primary', type: 'button', text: 'Antworten', onclick: () => submit([...sel].sort((a, b) => a - b)) });
          container.appendChild(info);
          container.appendChild(el('div', { class: 'row-right' }, btn));
        },
        evaluate(answer) {
          const truthSet = new Set(midis);
          const ansSet = new Set(answer);
          let hits = 0;
          for (const m of ansSet) if (truthSet.has(m)) hits++;
          const wrong = ansSet.size - hits;
          const missed = truthSet.size - hits;
          const score = Math.max(0, (hits - wrong) / truthSet.size);
          return {
            score,
            correct: wrong === 0 && missed === 0,
            truthKey: 'n' + n + (diatonic ? 'd' : 'c'),
            answerKey: 'n' + ansSet.size + (wrong === 0 && missed === 0 ? 'ok' : 'x'),
            truthLabel: midis.map((m) => midiToHelmholtz(m)).join(' ') + ` (${n} Töne)`,
            answerLabel: [...ansSet].sort((a, b) => a - b).map((m) => midiToHelmholtz(m)).join(' ') + (wrong ? ` · ${wrong} falsch` : '') + (missed ? ` · ${missed} fehlen` : ''),
            playTruth: () => play(chordEvents(midis, ens, { dur: 2.5 })),
            playAnswer: ansSet.size ? () => play(chordEvents([...ansSet].sort((a, b) => a - b), ens, { dur: 2.5 })) : null,
          };
        },
      };
    },
  },
];
