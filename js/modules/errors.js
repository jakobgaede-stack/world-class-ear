// Modul Fehlerhören: Melodie (eine Stimme), Akkord, Choral (vier Stimmen, mit Partitur).
import { randomChorale, randomPhraseSpan, excerpt, soundingPcs } from '../data/chorales.js';
import { renderExcerpt } from '../notation/score.js';
import { assignParts, ensembleName } from '../audio/ensembles.js';
import { CHORD_BY_ID, voiceChord, chordSymbol, chordNameDe } from '../theory/chords.js';
import { pick, randInt, weightedPick, midiToHelmholtz, spellingToHelmholtz, pcName, pc } from '../theory/pitch.js';
import { chordEvents, preload, play, answerGrid, el } from './common.js';
import { state } from '../engine/state.js';

const PART_DE = { S: 'Sopran', A: 'Alt', T: 'Tenor', B: 'Bass' };
const PART_RANGE = { S: [57, 81], A: [53, 74], T: [48, 69], B: [36, 64] };

export const ERROR_TYPES = {
  pitch: { de: 'Tonhöhe', sub: 'falscher Ton' },
  octave: { de: 'Oktave', sub: 'Oktavversetzung' },
  rhythm: { de: 'Rhythmus / Einsatz', sub: 'Dauer oder Einsatz' },
  missing: { de: 'Fehlende Note', sub: 'Stimme setzt aus' },
  articulation: { de: 'Artikulation', sub: 'staccato statt legato' },
  dynamics: { de: 'Dynamik', sub: 'Stimme plötzlich lauter' },
  none: { de: 'Kein Fehler', sub: 'alles stimmt' },
};

const E_HOMO = ['choir', 'organ', 'strings', 'woodwinds', 'brass'];
const E_MIX = ['choir', 'organ', 'strings', 'woodwinds', 'brass', 'mixed'];

// Stufen Choral (Doc: Modul Fehlerhören)
const choraleStages = [
  { diff: 10, label: 'Partitur + Klangmodell, chromatischer Fehler, Außenstimmen', model: true, nErr: [1, 1], kinds: ['pitch_chrom'], voices: 'outer', ens: E_HOMO, phrases: 1 },
  { diff: 22, label: 'diatonische Fehler, Bass und Tenor bevorzugt', model: true, nErr: [1, 1], kinds: ['pitch_chrom', 'pitch_diat'], voices: 'lower', ens: E_HOMO, phrases: 1 },
  { diff: 34, label: 'ohne Klangmodell; Oktave, Vorzeichen, Rhythmus, Einsatz', model: false, nErr: [1, 1], kinds: ['pitch_chrom', 'pitch_diat', 'octave', 'accidental', 'rhythm', 'entry'], voices: 'lower', ens: E_MIX, phrases: 1 },
  { diff: 46, label: '0 bis 2 Fehler; akkordeigen, fehlende Stimme, Artikulation, Dynamik', model: false, nErr: [0, 2], kinds: ['pitch_chrom', 'pitch_diat', 'pitch_chord', 'octave', 'accidental', 'rhythm', 'entry', 'missing', 'articulation', 'dynamics'], voices: 'all', ens: E_MIX, phrases: 1 },
  { diff: 58, label: 'zwei Phrasen, 0 bis 2 Fehler, alle Arten', model: false, nErr: [0, 2], kinds: ['pitch_chrom', 'pitch_diat', 'pitch_chord', 'octave', 'accidental', 'rhythm', 'entry', 'missing', 'articulation', 'dynamics'], voices: 'all', ens: E_MIX, phrases: 2 },
  { diff: 70, label: 'drei Phrasen, schnelleres Tempo', model: false, nErr: [0, 3], kinds: ['pitch_chrom', 'pitch_diat', 'pitch_chord', 'octave', 'accidental', 'rhythm', 'entry', 'missing', 'articulation', 'dynamics'], voices: 'all', ens: E_MIX, phrases: 3, bpm: 80 },
];

const melodyStages = [
  { diff: 6, label: 'eine Stimme, chromatischer Fehler, Klangmodell', model: true, nErr: [1, 1], kinds: ['pitch_chrom'], ens: ['piano', 'strings', 'woodwinds', 'brass'], phrases: 1 },
  { diff: 18, label: 'diatonische Fehler', model: true, nErr: [1, 1], kinds: ['pitch_chrom', 'pitch_diat'], ens: ['piano', 'strings', 'woodwinds', 'brass', 'choir'], phrases: 1 },
  { diff: 30, label: 'ohne Klangmodell; Oktave, Rhythmus', model: false, nErr: [1, 1], kinds: ['pitch_chrom', 'pitch_diat', 'octave', 'accidental', 'rhythm', 'entry'], ens: E_MIX, phrases: 1 },
  { diff: 44, label: '0 bis 2 Fehler, zwei Phrasen', model: false, nErr: [0, 2], kinds: ['pitch_chrom', 'pitch_diat', 'octave', 'accidental', 'rhythm', 'entry', 'missing', 'articulation'], ens: E_MIX, phrases: 2 },
  { diff: 58, label: 'drei Phrasen, schneller', model: false, nErr: [0, 2], kinds: ['pitch_chrom', 'pitch_diat', 'octave', 'accidental', 'rhythm', 'entry', 'missing', 'articulation'], ens: E_MIX, phrases: 3, bpm: 84 },
];

function partWeight(name, mode) {
  if (mode === 'outer') return name === 'S' || name === 'B' ? 1 : 0;
  if (mode === 'lower') return name === 'B' ? 0.35 : name === 'T' ? 0.25 : 0.2;
  return name === 'B' ? 0.3 : name === 'T' ? 0.3 : 0.2;
}

function keyPcs(ex) {
  return ex.key?.pcs || new Set([0, 2, 4, 5, 7, 9, 11]);
}

/** Klon der Stimmen für die Fehlerfassung */
function cloneParts(parts) {
  return parts.map((p) => ({ ...p, notes: p.notes.map((n) => ({ ...n })) }));
}

/**
 * Einen Fehler einbauen. Rückgabe: { type (Antwortkategorie), kind, part, idx, t, label } oder null.
 */
function injectOne(ex, parts, kind, partIdx, usedIdx) {
  const part = parts[partIdx];
  const notes = part.notes;
  const pcs = keyPcs(ex);
  const [rlo, rhi] = PART_RANGE[part.name] || [40, 80];
  // Kandidaten: nicht die erste Note des Ausschnitts (Zählzeit 1), nicht die letzte, Dauer >= 0.5
  const cands = notes
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => i > 0 && i < notes.length - 1 && n.d >= 0.5 - 1e-6 && !usedIdx.has(i) && !n.clippedStart && n.tie !== 'stop' && n.tie !== 'continue');
  if (!cands.length) return null;
  const tries = 12;
  for (let k = 0; k < tries; k++) {
    const { n, i } = pick(cands);
    const other = soundingPcs(parts, n.o, partIdx);
    const otherMidis = new Set(other.midis);
    const pcN = pc(n.m);
    const label = (txt) => `${PART_DE[part.name] || part.name}, Takt ${measureOf(ex, n.o)}: ${txt}`;
    if (kind === 'pitch_chrom') {
      const dirs = [1, -1].filter((d) => !pcs.has(pc(n.m + d)) && !otherMidis.has(n.m + d));
      if (!dirs.length) continue;
      const d = pick(dirs);
      const old = n.m;
      n.m += d;
      return { type: 'pitch', kind, part: partIdx, idx: n.idx, i, t: n.o, dir: d > 0 ? 'hoch' : 'tief', label: label(`${midiToHelmholtz(old)} statt ${midiToHelmholtz(n.m)} gespielt (Halbton ${d > 0 ? 'zu hoch' : 'zu tief'}, tonartfremd)`) };
    }
    if (kind === 'pitch_diat') {
      const opts = [1, 2, -1, -2].filter((d) => pcs.has(pc(n.m + d)) && !otherMidis.has(n.m + d) && n.m + d >= rlo - 2 && n.m + d <= rhi + 2);
      if (!opts.length) continue;
      const d = pick(opts);
      const old = n.m;
      n.m += d;
      return { type: 'pitch', kind, part: partIdx, idx: n.idx, i, t: n.o, dir: d > 0 ? 'hoch' : 'tief', label: label(`Nachbarton ${midiToHelmholtz(n.m)} statt ${midiToHelmholtz(old)} (leitereigen, ${d > 0 ? 'zu hoch' : 'zu tief'})`) };
    }
    if (kind === 'pitch_chord') {
      const choices = [...other.pcs].filter((p) => p !== pcN);
      if (!choices.length) continue;
      const p = pick(choices);
      let delta = ((p - pcN + 12) % 12);
      if (delta > 6) delta -= 12;
      const m2 = n.m + delta;
      if (otherMidis.has(m2) || m2 < rlo - 2 || m2 > rhi + 2) continue;
      const old = n.m;
      n.m = m2;
      return { type: 'pitch', kind, part: partIdx, idx: n.idx, i, t: n.o, dir: delta > 0 ? 'hoch' : 'tief', label: label(`anderer Akkordton ${midiToHelmholtz(n.m)} statt ${midiToHelmholtz(old)}`) };
    }
    if (kind === 'accidental') {
      const acc = /^[A-G](#+|-+)/.exec(n.spelling);
      if (!acc) continue;
      const d = acc[1][0] === '#' ? -1 : 1;
      if (otherMidis.has(n.m + d)) continue;
      const old = n.m;
      n.m += d;
      return { type: 'pitch', kind, part: partIdx, idx: n.idx, i, t: n.o, dir: d > 0 ? 'hoch' : 'tief', label: label(`Vorzeichen ignoriert: ${midiToHelmholtz(n.m)} statt ${midiToHelmholtz(old)}`) };
    }
    if (kind === 'octave') {
      const dirs = [12, -12].filter((d) => n.m + d >= rlo - 5 && n.m + d <= rhi + 5);
      if (!dirs.length) continue;
      const d = pick(dirs);
      n.m += d;
      return { type: 'octave', kind, part: partIdx, idx: n.idx, i, t: n.o, dir: d > 0 ? 'hoch' : 'tief', label: label(`eine Oktave ${d > 0 ? 'höher' : 'tiefer'} gespielt`) };
    }
    if (kind === 'rhythm') {
      const next = notes[i + 1];
      if (!next || next.d < 1 - 1e-6 || next.o - (n.o + n.d) > 1e-6) continue;
      n.d += 0.5;
      next.o += 0.5;
      next.d -= 0.5;
      return { type: 'rhythm', kind, part: partIdx, idx: n.idx, i, t: n.o, label: label(`Note um eine Achtel zu lang gehalten, Folgeton zu spät`) };
    }
    if (kind === 'entry') {
      const prev = notes[i - 1];
      if (!prev || prev.d < 1 - 1e-6 || n.o - (prev.o + prev.d) > 1e-6) continue;
      if (Math.random() < 0.5) {
        prev.d -= 0.5;
        n.o -= 0.5;
        n.d += 0.5;
        return { type: 'rhythm', kind, part: partIdx, idx: n.idx, i, t: n.o + 0.5, label: label(`Einsatz eine Achtel zu früh`) };
      }
      if (n.d < 1 - 1e-6) continue;
      prev.d += 0.5;
      n.o += 0.5;
      n.d -= 0.5;
      return { type: 'rhythm', kind, part: partIdx, idx: n.idx, i, t: n.o - 0.5, label: label(`Einsatz eine Achtel zu spät`) };
    }
    if (kind === 'missing') {
      if (n.d < 1 - 1e-6) continue;
      n.silent = true;
      return { type: 'missing', kind, part: partIdx, idx: n.idx, i, t: n.o, label: label(`Note fehlt (Stimme setzt aus)`) };
    }
    if (kind === 'articulation') {
      if (n.d < 1 - 1e-6) continue;
      n.staccato = true;
      return { type: 'articulation', kind, part: partIdx, idx: n.idx, i, t: n.o, label: label(`staccato statt gehalten`) };
    }
    if (kind === 'dynamics') {
      n.gainDb = 9;
      if (notes[i + 1]) notes[i + 1].gainDb = 9;
      return { type: 'dynamics', kind, part: partIdx, idx: n.idx, i, t: n.o, label: label(`Stimme plötzlich deutlich lauter`) };
    }
  }
  return null;
}

export function measureOf(ex, t) {
  const m = ex.chorale.measures.find((mm) => t >= mm.offset - 1e-6 && t < mm.offset + mm.quarters - 1e-6);
  return m ? m.number : '?';
}

/** Choralausschnitt als Ereignisse. gains: dB je Stimme. */
export function choraleEvents(ex, parts, ensembleId, { bpm = 66, gains = null, insts = null } = {}) {
  const spb = 60 / bpm;
  const partInsts = insts || assignParts(ensembleId, parts.map((p) => {
    const ms = p.notes.map((n) => n.m);
    return { lo: Math.min(...ms), hi: Math.max(...ms) };
  }));
  const events = [];
  parts.forEach((p, pi) => {
    const inst = partInsts[pi];
    let last = null;
    for (const n of p.notes) {
      if (n.silent) { last = null; continue; }
      const t = (n.o - ex.start) * spb;
      const fermataFactor = n.fermata ? 1.6 : 1;
      let dur = n.d * spb * fermataFactor;
      if ((n.tie === 'stop' || n.tie === 'continue') && last) {
        last.dur += dur;
        continue;
      }
      if (n.staccato) dur = Math.min(dur, 0.18);
      else dur = Math.max(0.12, dur - 0.04);
      const e = { inst, art: n.staccato ? 'stac' : 'sus', midi: n.m, t, dur, gainDb: (gains ? gains[pi] || 0 : 0) + (n.gainDb || 0) };
      events.push(e);
      last = e;
    }
  });
  // Fermaten: Zeitachse nach Fermaten dehnen (Luft nach jeder Phrase)
  const fermataTimes = [];
  for (const n of parts[0].notes) if (n.fermata) fermataTimes.push((n.o + n.d - ex.start) * spb);
  for (const e of events) {
    let shift = 0;
    for (const ft of fermataTimes) if (e.t >= ft - 1e-6) shift += 0.9;
    e.t += shift;
    // Dehnung der Fermatennote selbst ist bereits über fermataFactor enthalten
  }
  return events;
}

function buildItem(skillId, stages, stageIndex, { single } = {}) {
  const stage = stages[stageIndex];
  return (async () => {
    const chorale = await randomChorale((c) => c.nPhrases >= stage.phrases);
    const span = randomPhraseSpan(chorale, stage.phrases);
    const ex = excerpt(chorale, span.start, span.end);
    let partIdxs = [0, 1, 2, 3];
    if (single) partIdxs = [weightedPick([{ v: 0, w: 0.2 }, { v: 1, w: 0.25 }, { v: 2, w: 0.3 }, { v: 3, w: 0.25 }])];
    const partsOrig = partIdxs.map((i) => ex.parts[i]);
    const parts = cloneParts(partsOrig);
    const nErr = randInt(stage.nErr[0], stage.nErr[1]);
    const errors = [];
    const used = partIdxs.map(() => new Set());
    for (let e = 0; e < nErr; e++) {
      let placed = null;
      for (let k = 0; k < 10 && !placed; k++) {
        const kind = pick(stage.kinds);
        const pIdx = single ? 0 : weightedPick(parts.map((p, i) => ({ v: i, w: partWeight(p.name, stage.voices) })).filter((x) => x.w > 0));
        placed = injectOne(ex, parts, kind, pIdx, used[pIdx]);
        if (placed) { used[pIdx].add(placed.i); if (placed.i > 0) used[pIdx].add(placed.i - 1); used[pIdx].add(placed.i + 1); }
      }
      if (placed) errors.push(placed);
    }
    const ens = pick(stage.ens);
    const bpm = stage.bpm || state.settings.bpmChorale || 66;
    const insts = assignParts(ens, parts.map((p) => {
      const ms = p.notes.map((n) => n.m);
      return { lo: Math.min(...ms), hi: Math.max(...ms) };
    }));
    const evWrong = choraleEvents(ex, parts, ens, { bpm, insts });
    const evRight = choraleEvents(ex, partsOrig, ens, { bpm, insts });
    const allEvents = [...evWrong, ...evRight];
    const typeKeys = [...new Set(stage.kinds.map((k) => (k.startsWith('pitch') || k === 'accidental' ? 'pitch' : k === 'entry' ? 'rhythm' : k)))];
    if (stage.nErr[0] === 0) typeKeys.push('none');
    const partNames = parts.map((p) => PART_DE[p.name] || p.name);
    const title = single ? 'Fehlerhören: Melodie' : 'Fehlerhören: Choral';
    const nameLine = `${chorale.title} (BWV ${chorale.bwv}, Riemenschneider ${chorale.riemenschneider})`;
    let picked = null; // {part, idx, note}
    let scoreView = null;
    const item = {
      skill: skillId,
      stageIndex,
      diff: stage.diff + errors.reduce((s, e) => s + (e.kind === 'pitch_chord' ? 6 : e.kind === 'pitch_diat' ? 3 : 0) + (parts[e.part]?.name === 'B' ? 4 : parts[e.part]?.name === 'T' ? 3 : 0), 0) + (ens === 'mixed' ? 4 : 0),
      title,
      hint: `${nameLine} · ${ensembleName(ens)} · ${stage.model ? 'zuerst die korrekte Fassung, dann die Fassung mit Fehler' : 'ein Durchgang'} · ${stage.nErr[0] === 0 ? 'auch fehlerfrei möglich' : nErr + (nErr === 1 ? ' Fehler' : ' Fehler')}`,
      replays: 0,
      knowledge: 'error:' + (errors[0]?.kind || 'none'),
      model: stage.model,
      async load(p) { await preload(allEvents, p); },
      play() {
        if (stage.model) {
          const first = play(evRight);
          const total = first.duration + 1.2;
          const handles = { first, second: null };
          const done = first.done.then(() => new Promise((res) => setTimeout(res, 1100))).then(() => { handles.second = play(evWrong); return handles.second.done; });
          return { done, stop: () => { first.stop(); handles.second?.stop(); }, duration: total + first.duration };
        }
        return play(evWrong);
      },
      playModel() { return play(evRight); },
      renderPrompt(container) {
        const box = el('div', { class: 'score-box' });
        container.appendChild(box);
        scoreView = renderExcerpt(box, ex, {
          parts: partIdxs,
          maxWidth: Math.min(container.clientWidth || 900, 1100),
          onPick: (part, idx, note, nb) => {
            picked = { part: partIdxs.indexOf(part), idx, note };
            scoreView.highlight(nb);
            const sel = container.querySelector('.picked-info');
            if (sel) sel.textContent = `${partNames[picked.part]}, Takt ${measureOf(ex, note.o)}, ${spellingToHelmholtz(note.spelling)} gewählt`;
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
        const dirGrid = answerGrid(dirRow, [{ key: 'hoch', label: 'zu hoch' }, { key: 'tief', label: 'zu tief' }], (key, b) => {
          chosenDir = key;
          for (const x of dirGrid.querySelectorAll('.abtn')) x.classList.toggle('selected', x === b);
        }, { columns: 2 });
        container.appendChild(dirRow);
        const btn = el('button', { class: 'btn primary', type: 'button', text: 'Antworten', disabled: 'disabled' });
        const check = () => {
          const ok = chosenType && (chosenType === 'none' || picked);
          if (ok) btn.removeAttribute('disabled'); else btn.setAttribute('disabled', 'disabled');
        };
        const obs = setInterval(check, 300);
        btn.addEventListener('click', () => { clearInterval(obs); submit({ type: chosenType, dir: chosenDir, picked }); });
        container.appendChild(el('div', { class: 'row-right' }, btn));
      },
      evaluate(answer) {
        const spb = 60 / bpm;
        let score = 0;
        let falseAlarm = false;
        let detail = '';
        if (!errors.length) {
          score = answer.type === 'none' ? 1 : 0;
          falseAlarm = answer.type !== 'none';
          detail = answer.type === 'none' ? 'Richtig: kein Fehler.' : 'Fehlalarm: die Fassung war korrekt.';
        } else if (answer.type === 'none' || !answer.picked) {
          score = 0;
          detail = 'Fehler übersehen.';
        } else {
          // bester Treffer über alle Fehler
          let best = 0;
          for (const er of errors) {
            const partOk = er.part === answer.picked.part;
            const tAns = answer.picked.note.o;
            const posOk = Math.abs(tAns - er.t) <= 1.0 + 1e-6;
            const typeOk = er.type === answer.type;
            let s = 0;
            if (partOk && posOk) s = typeOk ? 1 : 0.5;
            else if (partOk || posOk) s = 0.25;
            if (s > best) best = s;
          }
          score = best;
          if (errors.length > 1) score = score * 0.5 + 0.5 * score; // Mehrfachfehler: Bewertung über den besten Treffer
          detail = best === 1 ? 'Stimme, Stelle und Art richtig.' : best === 0.5 ? 'Stimme und Stelle richtig, Art nicht.' : best === 0.25 ? 'Nur Stimme oder nur Stelle richtig.' : 'Weder Stimme noch Stelle.';
        }
        const truthLabel = errors.length ? errors.map((e) => e.label).join(' · ') : 'Kein Fehler, die Fassung war korrekt.';
        const answerLabel = answer.type === 'none' || !answer.picked
          ? ERROR_TYPES[answer.type]?.de || '–'
          : `${partNames[answer.picked.part]}, Takt ${measureOf(ex, answer.picked.note.o)}, ${spellingToHelmholtz(answer.picked.note.spelling)}: ${ERROR_TYPES[answer.type]?.de}${answer.dir ? ' (' + (answer.dir === 'hoch' ? 'zu hoch' : 'zu tief') + ')' : ''}`;
        const marks = errors.map((e) => ({ part: partIdxs[e.part], idx: e.idx, color: '#d9534f' }));
        return {
          score,
          correct: score >= 0.999,
          truthKey: errors.length ? errors[0].type : 'none',
          answerKey: answer.type,
          truthLabel,
          answerLabel,
          detail,
          falseAlarm,
          marks,
          renderFeedbackScore(container) {
            const box = el('div', { class: 'score-box' });
            container.appendChild(box);
            renderExcerpt(box, ex, { parts: partIdxs, marks, maxWidth: Math.min(container.clientWidth || 900, 1100) });
          },
          playTruth: () => play(evRight),
          playAnswer: () => play(evWrong),
          truthPlayLabel: 'korrekte Fassung',
          answerPlayLabel: 'gespielte Fassung',
        };
      },
    };
    return item;
  })();
}

// Akkordfehler: Symbol gezeigt, ein Ton verstimmt (Halbton) oder korrekt
const chordErrStages = [
  { diff: 8, label: 'Dreiklänge, Klavier, ein Ton um Halbton', types: ['maj', 'min', 'dim', 'aug'], ens: ['piano'], none: 0.2, dur: 3 },
  { diff: 20, label: 'Septakkorde, homogener Satz', types: ['dom7', 'maj7', 'm7', 'm7b5', 'dim7', 'mMaj7'], ens: ['piano', 'strings', 'woodwinds', 'brass'], none: 0.25, dur: 3 },
  { diff: 32, label: 'weite Lage, gemischte Farben', types: ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'm7', 'm7b5', 'dim7', 'mMaj7'], ens: ['strings', 'woodwinds', 'brass', 'mixed'], none: 0.25, dur: 2.5, wide: true },
  { diff: 44, label: 'Erweiterungen, Orchestersatz', types: ['dom9', 'maj9', 'm9', '7b9', 'dom13', 'maj7#11'], ens: ['mixed', 'orchestra', 'choir', 'organ'], none: 0.3, dur: 2.5, wide: true },
  { diff: 56, label: 'kurz, alle', types: ['maj', 'min', 'dom7', 'maj7', 'm7', 'm7b5', 'dom9', 'maj9', 'm9', 'dom13'], ens: ['mixed', 'orchestra', 'strings', 'brass'], none: 0.3, dur: 1.0, wide: true },
];

const chordErrSkill = {
  id: 'err_chord',
  name: 'Fehlerhören: Akkord',
  family: 'errors',
  stages: chordErrStages,
  itemSeconds: 12,
  dailyMin: 15,
  dailyMax: 30,
  importance: 1,
  generate(stageIndex) {
    const stage = chordErrStages[stageIndex];
    const type = CHORD_BY_ID[pick(stage.types)];
    const root = randInt(0, 11);
    const flats = [5, 10, 3, 8, 1].includes(root);
    const v = voiceChord(type, root, { inversion: 0, spacing: stage.wide ? pick(['open', 'wide']) : 'close', bassTarget: randInt(44, 56), lo: 30, hi: 92 });
    const midis = v.midis.slice();
    const members = v.members.slice();
    const hasError = Math.random() > stage.none;
    let wrongIdx = -1;
    let dir = 0;
    if (hasError) {
      wrongIdx = randInt(0, midis.length - 1);
      dir = Math.random() < 0.5 ? 1 : -1;
      midis[wrongIdx] += dir;
    }
    const ens = pick(stage.ens);
    const events = chordEvents(midis, ens, { dur: stage.dur, art: stage.dur < 1.2 ? 'stac' : 'sus' });
    const eventsRight = chordEvents(v.midis, ens, { dur: stage.dur, art: stage.dur < 1.2 ? 'stac' : 'sus' });
    const sym = chordSymbol(type, root, { flats });
    const memberOpts = [...new Set(members)].map((m) => ({ key: m, label: m }));
    memberOpts.push({ key: 'none', label: 'korrekt', sub: 'kein Fehler' });
    const truthKey = hasError ? members[wrongIdx] : 'none';
    return {
      skill: 'err_chord',
      stageIndex,
      diff: stage.diff,
      title: 'Fehlerhören: Akkord',
      hint: `Gespielt werden soll ${chordNameDe(type, root, { flats })} (${sym}) · ${ensembleName(ens)} · Welcher Akkordton stimmt nicht?`,
      replays: 0,
      knowledge: 'chord:' + type.id,
      async load(p) { await preload([...events, ...eventsRight], p); },
      play() { return play(events); },
      renderAnswer(container, submit) {
        answerGrid(container, memberOpts, (key) => submit(key), { columns: 3 });
      },
      evaluate(answer) {
        const correct = answer === truthKey;
        return {
          score: correct ? 1 : 0,
          correct,
          truthKey,
          answerKey: answer,
          truthLabel: hasError ? `${members[wrongIdx]} (${midiToHelmholtz(v.midis[wrongIdx], { flats })}) wurde ${dir > 0 ? 'einen Halbton zu hoch' : 'einen Halbton zu tief'} gespielt` : 'Akkord war korrekt',
          answerLabel: answer === 'none' ? 'korrekt' : answer,
          falseAlarm: !hasError && answer !== 'none',
          playTruth: () => play(eventsRight),
          playAnswer: () => play(events),
          truthPlayLabel: 'korrekter Akkord',
          answerPlayLabel: 'gespielter Akkord',
        };
      },
    };
  },
};

export const SKILLS = [
  {
    id: 'err_melody',
    name: 'Fehlerhören: Melodie',
    family: 'errors',
    stages: melodyStages,
    itemSeconds: 30,
    dailyMin: 8,
    dailyMax: 16,
    importance: 1,
    async: true,
    generate(stageIndex) { return buildItem('err_melody', melodyStages, stageIndex, { single: true }); },
  },
  chordErrSkill,
  {
    id: 'err_chorale',
    name: 'Fehlerhören: Choral',
    family: 'errors',
    stages: choraleStages,
    itemSeconds: 45,
    dailyMin: 6,
    dailyMax: 14,
    importance: 1.4,
    async: true,
    generate(stageIndex) { return buildItem('err_chorale', choraleStages, stageIndex, { single: false }); },
  },
];

export { PART_DE };
