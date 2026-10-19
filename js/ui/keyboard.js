// Bildschirmklavier: Tasten im Bereich [lo, hi], Auswahl per Klick (mehrere Töne), optional MIDI-Eingabe.
import { el } from '../modules/common.js';
import { midiToHelmholtz } from '../theory/pitch.js';

const BLACK = new Set([1, 3, 6, 8, 10]);

/**
 * @param container Element
 * @param opts { lo, hi, selected:Set, onChange(set), fixed:Set (nicht abwählbar, markiert), maxSelect }
 */
export function keyboard(container, opts = {}) {
  const lo = opts.lo ?? 48;
  const hi = opts.hi ?? 72;
  const selected = opts.selected || new Set();
  const fixed = opts.fixed || new Set();
  const wrap = el('div', { class: 'kbd' });
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!BLACK.has(m % 12)) whites.push(m);
  const ww = 100 / whites.length;
  const keys = new Map();
  whites.forEach((m, i) => {
    const k = el('div', { class: 'key white', style: `left:${i * ww}%;width:${ww}%`, 'data-midi': m });
    k.appendChild(el('span', { class: 'key-label', text: midiToHelmholtz(m) }));
    wrap.appendChild(k);
    keys.set(m, k);
  });
  whites.forEach((m, i) => {
    const b = m + 1;
    if (b <= hi && BLACK.has(b % 12)) {
      const k = el('div', { class: 'key black', style: `left:${(i + 1) * ww - ww * 0.3}%;width:${ww * 0.6}%`, 'data-midi': b });
      wrap.appendChild(k);
      keys.set(b, k);
    }
  });
  const refresh = () => {
    for (const [m, k] of keys) {
      k.classList.toggle('sel', selected.has(m));
      k.classList.toggle('fixed', fixed.has(m));
    }
  };
  wrap.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.key');
    if (!k) return;
    const m = Number(k.dataset.midi);
    if (fixed.has(m)) return;
    if (selected.has(m)) selected.delete(m);
    else {
      if (opts.maxSelect && selected.size >= opts.maxSelect) return;
      selected.add(m);
    }
    refresh();
    if (opts.onChange) opts.onChange(selected, m);
  });
  refresh();
  container.appendChild(wrap);
  return {
    el: wrap,
    selected,
    refresh,
    setSelected(set) { selected.clear(); for (const m of set) selected.add(m); refresh(); },
    mark(midis, cls) { for (const m of midis) keys.get(m)?.classList.add(cls); },
  };
}
