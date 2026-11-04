// Modul Blattsingen: Melodie lesen, ins Mikrofon singen, Tonhöhe und Einsatz werden bewertet (oktavtolerant).
import { generateMelody, melodyToExcerpt, EDLUND } from '../theory/melody.js';
import { renderExcerpt } from '../notation/score.js';
import { startMic, stopMic, segmentNotes } from '../audio/mic.js';
import { getCtx } from '../audio/context.js';
import { pick, randInt, midiToHelmholtz, pc, spellingToHelmholtz } from '../theory/pitch.js';
import { state } from '../engine/state.js';
import { el, preload, play, melodyEvents } from './common.js';
import { stopAll } from '../audio/sampler.js';

const LO = 43; // G2
const HI = 64; // E4 (Bass-Bariton, oktavtolerant bewertet)

const stages = [
  { diff: 6, label: 'diatonisch, schrittweise, Dreiklangsbrechungen, freies Tempo, Solmisation angezeigt', kind: 'tonal', minor: false, maxLeap: 2, n: [6, 8], rhythm: 'none', click: false, syl: true, startTone: 'first', tol: 50 },
  { diff: 18, label: 'Sprünge bis zur Sexte, Dur und Moll, mit Klick, einfache Rhythmen', kind: 'tonal', minorChance: 0.4, maxLeap: 5, n: [8, 10], rhythm: 'simple', click: true, syl: true, startTone: 'first', tol: 50 },
  { diff: 30, label: 'chromatische Durchgänge, nur Grundton vorgegeben, punktiert', kind: 'chromatic', minorChance: 0.5, maxLeap: 5, n: [8, 12], rhythm: 'dotted', click: true, syl: false, startTone: 'tonic', tol: 50 },
  { diff: 42, label: 'atonal nach Edlund: Sekunden, Terzen, Quarten', kind: 'atonal', edlund: [0, 1], n: [6, 9], rhythm: 'none', click: false, syl: false, startTone: 'first', tol: 35 },
  { diff: 54, label: 'Edlund: Tritonus, Quinten, Sexten', kind: 'atonal', edlund: [2, 3, 4], n: [8, 10], rhythm: 'plain', click: true, syl: false, startTone: 'first', tol: 35 },
  { diff: 66, label: 'Edlund: Septimen, Sprünge über die Oktave', kind: 'atonal', edlund: [5, 6], n: [8, 12], rhythm: 'simple', click: true, syl: false, startTone: 'first', tol: 35 },
  { diff: 80, label: 'atonal, sprunghaft, rhythmisiert', kind: 'atonal', edlund: [6], n: [10, 14], rhythm: 'syncopated', click: true, syl: false, startTone: 'first', tol: 35 },
];

function clickTrack(ctx, startAt, beats, bpm, countIn = 4) {
  const spb = 60 / bpm;
  const nodes = [];
  const total = countIn + Math.ceil(beats);
  for (let i = 0; i < total; i++) {
    const t = startAt + i * spb;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = i < countIn ? 1400 : i % 4 === 0 ? 1200 : 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(i < countIn ? 0.5 : 0.3, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
    nodes.push(osc);
  }
  return { stop: () => { for (const o of nodes) { try { o.stop(); } catch (e) {} } } };
}

/** DTW-Zuordnung gesungener Noten zu erwarteten Noten (oktavtolerant über Tonklasse). */
function alignNotes(expected, sung) {
  const n = expected.length;
  const m = sung.length;
  const cost = (i, j) => (pc(expected[i].m) === pc(sung[j].midi) ? 0 : 1);
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) D[i][0] = i; // ausgelassen
  for (let j = 1; j <= m; j++) D[0][j] = j * 0.6; // zusätzlich gesungen
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      D[i][j] = Math.min(D[i - 1][j - 1] + cost(i - 1, j - 1), D[i - 1][j] + 1, D[i][j - 1] + 0.6);
    }
  // Rückverfolgung
  const match = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const diag = D[i - 1][j - 1] + cost(i - 1, j - 1);
    if (D[i][j] === diag) { match[i - 1] = j - 1; i--; j--; }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  return match;
}

export const SKILLS = [
  {
    id: 'sing_melody',
    name: 'Blattsingen',
    family: 'singing',
    stages,
    itemSeconds: 45,
    dailyMin: 6,
    dailyMax: 12,
    importance: 1.1,
    generate(stageIndex) {
      const stage = stages[stageIndex];
      const minor = stage.minor ?? Math.random() < (stage.minorChance || 0);
      const n = randInt(stage.n[0], stage.n[1]);
      const mel = generateMelody({ kind: stage.kind, minor, n, lo: LO, hi: HI, maxLeap: stage.maxLeap || 4, edlund: stage.edlund ? pick(stage.edlund) : 0, rhythm: stage.rhythm, beats: 4, laMinor: state.settings.solfegeMinor !== 'do' });
      const bpm = 72;
      const spb = 60 / bpm;
      const ex = melodyToExcerpt(mel, { clef: 'bass', name: 'Singstimme', showSyllables: stage.syl });
      const startMidi = stage.startTone === 'tonic' ? (mel.notes[0].m - pc(mel.notes[0].m - mel.tonic) >= LO ? mel.notes[0].m - pc(mel.notes[0].m - mel.tonic) : mel.notes[0].m - pc(mel.notes[0].m - mel.tonic) + 12) : mel.notes[0].m;
      const startEvents = [{ inst: 'piano', art: 'sus', midi: startMidi, t: 0, dur: 1.2 }];
      const melodyEv = melodyEvents(mel.notes.map((nt) => ({ midi: nt.m, t: nt.o * spb, dur: nt.d * spb * 0.95 })), 'clarinet');
      let frames = [];
      let clickStart = null;
      let mic = null;
      let click = null;
      const item = {
        skill: 'sing_melody',
        stageIndex,
        diff: stage.diff + (n - 8),
        title: 'Blattsingen',
        hint: `${mel.keyLabel}${stage.kind === 'atonal' ? ' · ' + EDLUND[stage.edlund ? Math.max(...stage.edlund) : 0].label : ''} · ${n} Töne · ${stage.click ? 'mit Klick (' + bpm + '), ein Takt Vorzähler' : 'freies Tempo'} · ${stage.startTone === 'tonic' ? 'Grundton' : 'Anfangston'} wird vorgespielt · Bewertung oktavtolerant, ±${stage.tol} Cent`,
        replays: 99,
        manualStart: true,
        knowledge: stage.kind === 'atonal' ? 'singing:edlund' : stage.syl ? 'singing:solfege' : 'singing:technique',
        async load(p) { await preload([...startEvents, ...melodyEv], p); },
        renderPrompt(container) {
          const box = el('div', { class: 'score-box' });
          container.appendChild(box);
          try { renderExcerpt(box, ex, { maxWidth: Math.min(container.clientWidth || 900, 1100) }); } catch (e) { console.error(e); }
        },
        play() { return play(startEvents); },
        renderAnswer(container, submit) {
          const status = el('div', { class: 'muted small', text: 'Erst den Anfangston anhören (▶ Start), dann Aufnahme starten und singen.' });
          const meter = el('div', { class: 'pitch-meter' });
          const rec = el('button', { class: 'btn primary', text: '● Aufnahme starten' });
          const done = el('button', { class: 'btn', text: 'Fertig, bewerten', disabled: 'disabled' });
          let recording = false;
          rec.addEventListener('click', async () => {
            if (recording) return;
            try {
              frames = [];
              stopAll();
              mic = await startMic((f) => {
                frames.push(f);
                meter.textContent = f.midi !== null ? `${midiToHelmholtz(Math.round(f.midi))} (${Math.round((f.midi - Math.round(f.midi)) * 100)} ct)` : '…';
              });
              recording = true;
              rec.textContent = '● Aufnahme läuft';
              rec.setAttribute('disabled', 'disabled');
              done.removeAttribute('disabled');
              if (stage.click) {
                const ctx = getCtx();
                clickStart = ctx.currentTime + 0.3;
                const micT0 = performance.now();
                click = clickTrack(ctx, clickStart, mel.quarterLength, bpm, 4);
                item._clickOffsetSec = (clickStart - ctx.currentTime) + 0; // relativ zum Mikrofonstart
                item._micStartPerf = micT0;
                status.textContent = 'Vier Klicks Vorzähler, dann singen.';
              } else status.textContent = 'Singen, dann „Fertig“.';
            } catch (e) {
              status.textContent = 'Mikrofon nicht verfügbar: ' + e.message + ' (im Browser erlauben, Chrome empfohlen)';
            }
          });
          done.addEventListener('click', () => {
            if (!recording) return;
            recording = false;
            stopMic();
            if (click) click.stop();
            submit({ frames: frames.slice() });
          });
          container.appendChild(status);
          container.appendChild(el('div', { class: 'row' }, [rec, done, meter]));
        },
        evaluate(answer) {
          const sung = segmentNotes(answer.frames || []);
          const match = alignNotes(mel.notes, sung);
          let ok = 0;
          const details = [];
          const marks = [];
          mel.notes.forEach((nt, i) => {
            const j = match[i];
            const s = j !== null ? sung[j] : null;
            const pcOk = s && pc(s.midi) === pc(nt.m);
            const centsOk = s && Math.abs(s.cents) <= stage.tol;
            const good = pcOk && centsOk;
            if (good) ok++;
            else marks.push({ part: 0, idx: i, color: '#d9534f' });
            details.push(`${i + 1}. ${spellingToHelmholtz(nt.spelling)}: ${!s ? 'nicht erkannt' : good ? 'gut' : pcOk ? 'unsauber (' + (s.cents > 0 ? '+' : '') + s.cents + ' ct)' : 'gesungen ' + midiToHelmholtz(s.midi)}`);
          });
          let timingNote = '';
          let score = ok / mel.notes.length;
          if (stage.click && sung.length) {
            // Einsatz: erwarteter Beginn relativ zum Mikrofonstart = Klickstart + 4 Schläge
            const t0 = (item._clickOffsetSec || 0.3) + 4 * spb;
            let tOk = 0;
            let tN = 0;
            mel.notes.forEach((nt, i) => {
              const j = match[i];
              if (j === null) return;
              tN++;
              if (Math.abs(sung[j].start - (t0 + nt.o * spb)) <= spb * 0.5) tOk++;
            });
            if (tN) {
              const tScore = tOk / tN;
              score = 0.7 * score + 0.3 * tScore;
              timingNote = ` · Einsätze im Takt: ${tOk} von ${tN}`;
            }
          }
          const extra = sung.length - match.filter((x) => x !== null).length;
          return {
            score,
            correct: score >= 0.95,
            truthKey: stage.kind,
            answerKey: score >= 0.8 ? 'gut' : score >= 0.5 ? 'teils' : 'schwach',
            truthLabel: mel.notes.map((nt) => spellingToHelmholtz(nt.spelling)).join(' '),
            answerLabel: `${ok} von ${mel.notes.length} Tönen sauber${timingNote}${extra > 0 ? ' · ' + extra + ' zusätzliche Töne erkannt' : ''}`,
            detail: sung.length ? details.join(' · ') : 'Keine Töne erkannt. Mikrofon im Browser erlauben, nah am Mikrofon und auf einen Vokal singen.',
            marks,
            renderFeedbackScore(container) {
              const box = el('div', { class: 'score-box' });
              container.appendChild(box);
              renderExcerpt(box, ex, { marks, maxWidth: Math.min(container.clientWidth || 900, 1100) });
            },
            playTruth: () => play(melodyEv),
            playAnswer: sung.length ? () => play(sung.map((s) => ({ inst: 'sine', art: 'sus', midi: s.midi, t: s.start - sung[0].start, dur: Math.max(0.25, s.end - s.start) }))) : null,
            truthPlayLabel: 'Melodie (Klarinette)',
            answerPlayLabel: 'erkannte Töne',
          };
        },
      };
      return item;
    },
  },
];
