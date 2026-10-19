// Gemeinsame Bausteine für Übungsmodule: Besetzung, Wiedergabe, Antwortraster.
import { assignVoices, ENSEMBLES } from '../audio/ensembles.js';
import { loadAll, playEvents, playHold, stopAll } from '../audio/sampler.js';
import { state } from '../engine/state.js';
import { pick, randInt } from '../theory/pitch.js';

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}

export function chooseEnsemble(list) {
  return pick(list);
}

/** Akkord als Ereignisliste (gleichzeitig) */
export function chordEvents(midis, ensembleId, { art = 'sus', dur = 3, gains = null, t = 0 } = {}) {
  const voices = assignVoices(ensembleId, midis, art);
  return voices.map((v, i) => ({
    inst: v.inst,
    art: v.art,
    midi: v.midi,
    t,
    dur,
    gainDb: (v.gainDb || 0) + (gains ? gains[Math.min(i, gains.length - 1)] || 0 : 0),
  }));
}

/** Mehrere Akkorde nacheinander: chords = [{midis, dur}] */
export function progressionEvents(chords, ensembleId, { art = 'sus', gap = 0.05 } = {}) {
  const ev = [];
  let t = 0;
  for (const c of chords) {
    ev.push(...chordEvents(c.midis, ensembleId, { art, dur: c.dur, t, gains: c.gains }));
    t += c.dur + gap;
  }
  return ev;
}

/** Melodie (eine Stimme) als Ereignisse: notes = [{midi, t, dur}] */
export function melodyEvents(notes, inst, { art = 'sus', gainDb = 0 } = {}) {
  return notes.map((n) => ({ inst, art, midi: n.midi, t: n.t, dur: n.dur, gainDb }));
}

export async function preload(events, onProgress) {
  await loadAll(events, onProgress);
}

export function play(events) {
  stopAll();
  return playEvents(events);
}

/** Akkord abspielen; bei Halten-Modus (Stufe neu oder Einstellung „immer“) bis zur Antwort klingen lassen. */
export function playChord(events, { stageHold = false } = {}) {
  stopAll();
  const mode = state.settings.holdMode || 'new';
  const hold = mode === 'always' || (mode === 'new' && stageHold);
  return hold ? playHold(events) : playEvents(events);
}

export { stopAll };

/** Kadenz I-IV-V-I in einer Tonart (vierstimmig, enge Lage) */
export function cadenceChords(tonic, { minor = false, bassTarget = 48 } = {}) {
  const maj = (r) => [r, r + 4, r + 7];
  const min = (r) => [r, r + 3, r + 7];
  const I = minor ? min(tonic) : maj(tonic);
  const IV = minor ? min(tonic + 5) : maj(tonic + 5);
  const V = maj(tonic + 7);
  const V7 = [tonic + 7, tonic + 11, tonic + 14, tonic + 17];
  const toVoicing = (pcs, bass) => {
    // Bass = Grundton, drei Oberstimmen eng über dem Bass + Oktave
    const root = pcs[0];
    let b = bassTarget + ((((root % 12) + 12) % 12 - (((bassTarget % 12) + 12) % 12) + 12) % 12);
    if (b - bassTarget > 6) b -= 12;
    const upper = pcs.slice(1).concat(pcs.length === 3 ? [pcs[0]] : []);
    const out = [b];
    let prev = b + 7;
    for (const p of upper) {
      let m = prev + ((((p % 12) + 12) % 12 - (((prev % 12) + 12) % 12) + 12) % 12);
      if (m === prev) m += 12;
      out.push(m);
      prev = m;
    }
    return out.sort((a, c) => a - c);
  };
  return [
    { midis: toVoicing(I), dur: 0.7 },
    { midis: toVoicing(IV), dur: 0.7 },
    { midis: toVoicing(V7), dur: 0.7 },
    { midis: toVoicing(I), dur: 1.1 },
  ];
}

/**
 * Antwortraster: options = [{key, label, sub?}]; onPick(key) sofort beim Klick.
 */
export function answerGrid(container, options, onPick, { columns = 0, selectedKey = null } = {}) {
  const grid = el('div', { class: 'agrid' + (columns ? ' cols-' + columns : '') });
  for (const o of options) {
    const b = el('button', { class: 'abtn' + (o.key === selectedKey ? ' selected' : ''), type: 'button', 'data-key': o.key });
    b.appendChild(el('span', { class: 'abtn-label', text: o.label }));
    if (o.sub) b.appendChild(el('span', { class: 'abtn-sub', text: o.sub }));
    b.addEventListener('click', () => onPick(o.key, b));
    grid.appendChild(b);
  }
  container.appendChild(grid);
  return grid;
}

/**
 * Mehrteilige Antwort: groups = [{id, title, options}], submit(answers) nach Klick auf „Antworten“.
 */
export function multiAnswer(container, groups, submit, { submitLabel = 'Antworten' } = {}) {
  const chosen = {};
  const wrap = el('div', { class: 'multi'});
  const btn = el('button', { class: 'btn primary', type: 'button', text: submitLabel, disabled: 'disabled' });
  for (const g of groups) {
    wrap.appendChild(el('div', { class: 'group-title', text: g.title }));
    const grid = answerGrid(wrap, g.options, (key, b) => {
      chosen[g.id] = key;
      for (const x of grid.querySelectorAll('.abtn')) x.classList.toggle('selected', x === b);
      if (groups.every((gg) => chosen[gg.id] !== undefined)) btn.removeAttribute('disabled');
    }, { columns: g.columns || 0 });
  }
  btn.addEventListener('click', () => submit(chosen));
  wrap.appendChild(el('div', { class: 'row-right' }, btn));
  container.appendChild(wrap);
  return wrap;
}

export function fmtDb(db) {
  return (db > 0 ? '+' : '') + db + ' dB';
}

export function randomRegisterBass(register) {
  switch (register) {
    case 'low': return randInt(26, 42);
    case 'high': return randInt(72, 88);
    case 'all': return randInt(30, 84);
    default: return randInt(45, 66);
  }
}

export const REGISTER_DE = { mid: 'mittleres Register', high: 'hohes Register', low: 'tiefes Register', all: 'alle Register' };
export { ENSEMBLES };
