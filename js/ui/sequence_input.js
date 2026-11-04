// Eingabe einer Tonfolge auf dem Bildschirmklavier (für Diktate); zeigt die Eingabe als Notenzeile.
import { el } from '../modules/common.js';
import { keyboard } from './keyboard.js';
import { renderExcerpt } from '../notation/score.js';
import { midiToHelmholtz, pcName } from '../theory/pitch.js';
import { spellAtonal } from '../theory/melody.js';
import { playNote, loadInstrument } from '../audio/sampler.js';

/**
 * @param container
 * @param opts { lo, hi, maxNotes, pitchClassOnly (Oktave egal), onSubmit(midis), clef, label, previewInst, given (vorgegebene Anfangstöne, nicht löschbar) }
 */
export function sequenceInput(container, opts = {}) {
  const given = opts.given || [];
  const seq = given.slice();
  const wrap = el('div', { class: 'seq-input' });
  const staffBox = el('div', { class: 'score-box seq-staff' });
  const list = el('div', { class: 'seq-list muted small', text: opts.label || 'Töne der Reihe nach antippen.' });
  const lo = opts.lo ?? 48;
  const hi = opts.hi ?? 72;
  const previewInst = opts.previewInst || 'piano';
  let ready = null;
  const ensure = () => ready || (ready = loadInstrument(previewInst, 'sus').catch(() => {}));
  ensure();
  const kb = keyboard(wrap, { lo, hi, selected: new Set(), onChange: (set, m) => {
    // Klick = Ton anhängen (Auswahl-Markierung sofort zurücksetzen)
    set.clear();
    kb.refresh();
    if (opts.maxNotes && seq.length >= opts.maxNotes) return;
    seq.push(m);
    ensure().then(() => { try { playNote({ inst: previewInst, art: 'sus', midi: m, dur: 0.4, gainDb: -6 }); } catch (e) {} });
    refresh();
  } });
  const refresh = () => {
    list.textContent = seq.length ? seq.map((m, i) => (opts.pitchClassOnly ? pcName(m) : midiToHelmholtz(m)) + (i < given.length ? ' (gegeben)' : '')).join(' ') : (opts.label || 'Töne der Reihe nach antippen.');
    staffBox.innerHTML = '';
    staffBox.style.display = !seq.length || opts.pitchClassOnly ? 'none' : '';
    if (!seq.length || opts.pitchClassOnly) return;
    const notes = seq.map((m, idx) => ({ m, o: idx, d: 1, tie: null, fermata: false, spelling: spellAtonal(m, seq[idx - 1]), idx }));
    const beats = 4;
    const measures = [];
    for (let o = 0; o < seq.length; o += beats) measures.push({ number: o / beats + 1, offset: o, end: Math.min(o + beats, seq.length), quarters: Math.min(beats, seq.length - o) });
    const ex = { chorale: { keySig: 0, measures: measures.map((m) => ({ number: m.number, offset: m.offset, quarters: m.quarters })) }, start: 0, end: seq.length, parts: [{ name: 'E', clef: opts.clef || 'treble', notes }], measures, key: { flats: false }, timeSig: '4/4' };
    try { renderExcerpt(staffBox, ex, { maxWidth: Math.min(container.clientWidth || 900, 1100) }); } catch (e) { /* Anzeige optional */ }
  };
  const row = el('div', { class: 'row' });
  row.appendChild(el('button', { class: 'btn', type: 'button', text: 'Letzten Ton löschen', onclick: () => { if (seq.length > given.length) seq.pop(); refresh(); } }));
  row.appendChild(el('button', { class: 'btn ghost', type: 'button', text: 'Alles löschen', onclick: () => { seq.length = 0; seq.push(...given); refresh(); } }));
  const submit = el('button', { class: 'btn primary', type: 'button', text: 'Antworten', onclick: () => opts.onSubmit(seq.slice()) });
  row.appendChild(submit);
  wrap.appendChild(list);
  wrap.appendChild(staffBox);
  wrap.appendChild(row);
  container.appendChild(wrap);
  refresh();
  return { seq, refresh };
}
