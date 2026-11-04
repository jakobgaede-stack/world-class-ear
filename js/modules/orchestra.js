// Orchesterliteratur: Fehlerhören im Orchestersatz und passives Hören mit Partitur.
import { randomExcerpt, toExcerpt, activeParts } from '../data/orchestra.js';
import { renderExcerpt } from '../notation/score.js';
import { injectOne, cloneParts, choraleEvents, measureOf, ERROR_TYPES } from './errors.js';
import { pick, randInt, weightedPick, midiToHelmholtz, spellingToHelmholtz } from '../theory/pitch.js';
import { el, preload, play, answerGrid } from './common.js';

const stages = [
  { diff: 20, label: 'bis 6 Stimmen, Klangmodell, tonartfremder Fehler, Tempo gedrosselt', maxParts: 6, model: true, nErr: [1, 1], kinds: ['pitch_chrom'], tempo: 0.8 },
  { diff: 34, label: 'bis 10 Stimmen, leitereigene Fehler, Bass und Mittelstimmen bevorzugt', maxParts: 10, model: true, nErr: [1, 1], kinds: ['pitch_chrom', 'pitch_diat'], tempo: 0.85 },
  { diff: 48, label: 'bis 14 Stimmen, ohne Klangmodell; Oktave, Rhythmus, Einsatz', maxParts: 14, model: false, nErr: [1, 1], kinds: ['pitch_chrom', 'pitch_diat', 'octave', 'rhythm', 'entry'], tempo: 0.9 },
  { diff: 62, label: 'volle Partitur, 0 bis 2 Fehler, alle Arten, Originaltempo', maxParts: 99, model: false, nErr: [0, 2], kinds: ['pitch_chrom', 'pitch_diat', 'pitch_chord', 'octave', 'accidental', 'rhythm', 'entry', 'missing', 'articulation', 'dynamics'], tempo: 1 },
  { diff: 76, label: 'volle Partitur, 0 bis 3 Fehler, ein Durchgang', maxParts: 99, model: false, nErr: [0, 3], kinds: ['pitch_chrom', 'pitch_diat', 'pitch_chord', 'octave', 'accidental', 'rhythm', 'entry', 'missing', 'articulation', 'dynamics'], tempo: 1 },
];

function instWeight(inst, name) {
  if (/Violine I\b|Violine 1\b/.test(name)) return 0.6;
  if (['viola', 'cello', 'contrabass'].includes(inst)) return 1.3;
  if (['horn', 'bassoon', 'clarinet'].includes(inst)) return 1.2;
  if (inst === 'timpani') return 0.3;
  return 1;
}

async function buildOrchestraItem(stageIndex) {
  const stage = stages[stageIndex];
  let picked = null;
  for (let tries = 0; tries < 6 && !picked; tries++) {
    const r = await randomExcerpt((e) => e.nParts <= Math.max(stage.maxParts, 3) + 4);
    if (!r) break;
    const ex = toExcerpt(r.data);
    const act = activeParts(ex);
    if (act.length >= 3 && act.length <= stage.maxParts) picked = { ...r, ex, act };
    else if (tries === 5) picked = { ...r, ex, act };
  }
  if (!picked) throw new Error('Kein Orchesterausschnitt verfügbar');
  const { entry, data, ex, act } = picked;
  const partsOrig = act.map((i) => ex.parts[i]);
  const parts = cloneParts(partsOrig);
  const nErr = randInt(stage.nErr[0], stage.nErr[1]);
  const errors = [];
  const used = parts.map(() => new Set());
  for (let e = 0; e < nErr; e++) {
    let placed = null;
    for (let k = 0; k < 12 && !placed; k++) {
      const kind = pick(stage.kinds);
      const pIdx = weightedPick(parts.map((p, i) => ({ v: i, w: instWeight(p.inst, p.name) * (p.notes.length >= 3 ? 1 : 0.05) })));
      placed = injectOne(ex, parts, kind, pIdx, used[pIdx]);
      if (placed) { used[pIdx].add(placed.i); used[pIdx].add(placed.i - 1); used[pIdx].add(placed.i + 1); }
    }
    if (placed) errors.push(placed);
  }
  const bpm = Math.max(40, Math.min(150, (data.bpm || 96) * stage.tempo));
  const evWrong = choraleEvents(ex, parts, 'orchestra', { bpm });
  const evRight = choraleEvents(ex, partsOrig, 'orchestra', { bpm });
  const all = [...evWrong, ...evRight];
  const typeKeys = [...new Set(stage.kinds.map((k) => (k.startsWith('pitch') || k === 'accidental' ? 'pitch' : k === 'entry' ? 'rhythm' : k)))];
  if (stage.nErr[0] === 0) typeKeys.push('none');
  const partNames = parts.map((p) => p.name);
  const title = `${data.work}, ${data.movement}. Satz${data.movementTitle ? ' (' + data.movementTitle + ')' : ''}, T. ${data.measureFrom}–${data.measureTo}`;
  let pickedNote = null;
  let scoreView = null;
  return {
    skill: 'err_orchestra',
    stageIndex,
    diff: stage.diff + Math.min(10, act.length - 3) + errors.reduce((s, e) => s + (e.kind === 'pitch_chord' ? 6 : e.kind === 'pitch_diat' ? 3 : 0), 0),
    title: 'Fehlerhören: Orchestersatz',
    hint: `${title} · ${ex.key.label} · ${act.length} Stimmen (klingend notiert) · ${Math.round(bpm)} bpm · ${stage.model ? 'zuerst korrekt, dann mit Fehler' : 'ein Durchgang'} · ${stage.nErr[0] === 0 ? 'auch fehlerfrei möglich' : nErr + ' Fehler'}`,
    replays: 0,
    manualStart: true,
    model: stage.model,
    knowledge: 'error:orchestra',
    async load(p) { await preload(all, p); },
    play() {
      if (stage.model) {
        const first = play(evRight);
        const handles = { first, second: null };
        const done = first.done.then(() => new Promise((res) => setTimeout(res, 1200))).then(() => { handles.second = play(evWrong); return handles.second.done; });
        return { done, stop: () => { first.stop(); handles.second?.stop(); }, duration: first.duration * 2 + 1.2 };
      }
      return play(evWrong);
    },
    playModel() { return play(evRight); },
    renderPrompt(container) {
      const box = el('div', { class: 'score-box' });
      container.appendChild(box);
      scoreView = renderExcerpt(box, ex, {
        parts: act,
        partLabels: true,
        staffGap: 78,
        maxWidth: Math.min(container.clientWidth || 900, 1200),
        onPick: (part, idx, note, nb) => {
          pickedNote = { part: act.indexOf(part), idx, note };
          scoreView.highlight(nb);
          const sel = container.querySelector('.picked-info');
          if (sel) sel.textContent = `${partNames[pickedNote.part]}, Takt ${measureOf(ex, note.o)}, ${spellingToHelmholtz(note.spelling)} gewählt`;
        },
      });
      container.appendChild(el('div', { class: 'picked-info muted small', text: 'Stelle in der Partitur antippen, dann die Fehlerart wählen.' }));
    },
    renderAnswer(container, submit) {
      let chosenType = null;
      let chosenDir = null;
      const grid = answerGrid(container, typeKeys.map((k) => ({ key: k, label: ERROR_TYPES[k].de, sub: ERROR_TYPES[k].sub })), (key, b) => {
        chosenType = key;
        for (const x of grid.querySelectorAll('.abtn')) x.classList.toggle('selected', x === b);
        dirRow.style.display = key === 'pitch' || key === 'octave' ? '' : 'none';
        check();
      }, { columns: Math.min(typeKeys.length, 4) });
      const dirRow = el('div', { class: 'group', style: 'display:none' });
      dirRow.appendChild(el('div', { class: 'group-title', text: 'Richtung (optional)' }));
      const dirGrid = answerGrid(dirRow, [{ key: 'hoch', label: 'zu hoch' }, { key: 'tief', label: 'zu tief' }], (key, b) => { chosenDir = key; for (const x of dirGrid.querySelectorAll('.abtn')) x.classList.toggle('selected', x === b); }, { columns: 2 });
      container.appendChild(dirRow);
      const btn = el('button', { class: 'btn primary', type: 'button', text: 'Antworten', disabled: 'disabled' });
      const check = () => { if (chosenType && (chosenType === 'none' || pickedNote)) btn.removeAttribute('disabled'); else btn.setAttribute('disabled', 'disabled'); };
      const obs = setInterval(check, 300);
      btn.addEventListener('click', () => { clearInterval(obs); submit({ type: chosenType, dir: chosenDir, picked: pickedNote }); });
      container.appendChild(el('div', { class: 'row-right' }, btn));
    },
    evaluate(answer) {
      let score = 0;
      let detail = '';
      let falseAlarm = false;
      if (!errors.length) {
        score = answer.type === 'none' ? 1 : 0;
        falseAlarm = answer.type !== 'none';
        detail = score ? 'Richtig: kein Fehler.' : 'Fehlalarm: die Fassung war korrekt.';
      } else if (answer.type === 'none' || !answer.picked) {
        detail = 'Fehler übersehen.';
      } else {
        let best = 0;
        for (const er of errors) {
          const partOk = er.part === answer.picked.part;
          const posOk = Math.abs(answer.picked.note.o - er.t) <= 1.0 + 1e-6;
          const typeOk = er.type === answer.type;
          let s = 0;
          if (partOk && posOk) s = typeOk ? 1 : 0.5;
          else if (partOk || posOk) s = 0.25;
          best = Math.max(best, s);
        }
        score = best;
        detail = best === 1 ? 'Stimme, Stelle und Art richtig.' : best === 0.5 ? 'Stimme und Stelle richtig, Art nicht.' : best === 0.25 ? 'Nur Stimme oder nur Stelle richtig.' : 'Weder Stimme noch Stelle.';
      }
      const marks = errors.map((e) => ({ part: act[e.part], idx: e.idx, color: '#d9534f' }));
      return {
        score,
        correct: score >= 0.999,
        truthKey: errors.length ? errors[0].type : 'none',
        answerKey: answer.type,
        truthLabel: errors.length ? errors.map((e) => e.label).join(' · ') : 'Kein Fehler, die Fassung war korrekt.',
        answerLabel: answer.type === 'none' || !answer.picked ? ERROR_TYPES[answer.type]?.de || '–' : `${partNames[answer.picked.part]}, Takt ${measureOf(ex, answer.picked.note.o)}, ${spellingToHelmholtz(answer.picked.note.spelling)}: ${ERROR_TYPES[answer.type]?.de}${answer.dir ? ' (' + (answer.dir === 'hoch' ? 'zu hoch' : 'zu tief') + ')' : ''}`,
        detail,
        falseAlarm,
        marks,
        renderFeedbackScore(container) {
          const box = el('div', { class: 'score-box' });
          container.appendChild(box);
          renderExcerpt(box, ex, { parts: act, partLabels: true, staffGap: 78, marks, maxWidth: Math.min(container.clientWidth || 900, 1200) });
        },
        playTruth: () => play(evRight),
        playAnswer: () => play(evWrong),
        truthPlayLabel: 'korrekte Fassung',
        answerPlayLabel: 'gespielte Fassung',
      };
    },
  };
}

export const SKILLS = [
  {
    id: 'err_orchestra',
    name: 'Fehlerhören: Orchestersatz',
    family: 'errors',
    stages,
    itemSeconds: 75,
    dailyMin: 4,
    dailyMax: 10,
    importance: 1.4,
    async: true,
    generate(stageIndex) { return buildOrchestraItem(stageIndex); },
  },
];

/** Für das passive Hören: zufälliger Ausschnitt mit Ereignissen und Ausschnitt-Objekt */
export async function passiveOrchestra() {
  const r = await randomExcerpt((e) => e.quarters >= 16);
  if (!r) return null;
  const ex = toExcerpt(r.data);
  const act = activeParts(ex);
  const parts = act.map((i) => ex.parts[i]);
  const bpm = Math.max(40, Math.min(150, r.data.bpm || 96));
  const events = choraleEvents(ex, parts, 'orchestra', { bpm });
  return { ex, act, events, data: r.data, bpm };
}
