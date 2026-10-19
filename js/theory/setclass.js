// Setklassen: Primform (Rahn/Forte) und Forte-Namen für Tri- und Tetrachorde.
import { pc } from './pitch.js';

export const FORTE = {
  3: [
    ['3-1', [0, 1, 2]], ['3-2', [0, 1, 3]], ['3-3', [0, 1, 4]], ['3-4', [0, 1, 5]], ['3-5', [0, 1, 6]], ['3-6', [0, 2, 4]],
    ['3-7', [0, 2, 5]], ['3-8', [0, 2, 6]], ['3-9', [0, 2, 7]], ['3-10', [0, 3, 6]], ['3-11', [0, 3, 7]], ['3-12', [0, 4, 8]],
  ],
  4: [
    ['4-1', [0, 1, 2, 3]], ['4-2', [0, 1, 2, 4]], ['4-3', [0, 1, 3, 4]], ['4-4', [0, 1, 2, 5]], ['4-5', [0, 1, 2, 6]], ['4-6', [0, 1, 2, 7]],
    ['4-7', [0, 1, 4, 5]], ['4-8', [0, 1, 5, 6]], ['4-9', [0, 1, 6, 7]], ['4-10', [0, 2, 3, 5]], ['4-11', [0, 1, 3, 5]], ['4-12', [0, 2, 3, 6]],
    ['4-13', [0, 1, 3, 6]], ['4-14', [0, 2, 3, 7]], ['4-Z15', [0, 1, 4, 6]], ['4-16', [0, 1, 5, 7]], ['4-17', [0, 3, 4, 7]], ['4-18', [0, 1, 4, 7]],
    ['4-19', [0, 1, 4, 8]], ['4-20', [0, 1, 5, 8]], ['4-21', [0, 2, 4, 6]], ['4-22', [0, 2, 4, 7]], ['4-23', [0, 2, 5, 7]], ['4-24', [0, 2, 4, 8]],
    ['4-25', [0, 2, 6, 8]], ['4-26', [0, 3, 5, 8]], ['4-27', [0, 2, 5, 8]], ['4-28', [0, 3, 6, 9]], ['4-Z29', [0, 1, 3, 7]],
  ],
};

/** Beschreibende Namen für die 12 Trichorde (Friedmann-Familien) */
export const TRICHORD_INFO = {
  '3-1': { name: 'chromatischer Dreiton (0,1,2)', family: 1 },
  '3-2': { name: '(0,1,3) Halbton und kleine Terz', family: 1 },
  '3-3': { name: '(0,1,4) Halbton und große Terz', family: 1 },
  '3-4': { name: '(0,1,5) Halbton und Quarte', family: 1 },
  '3-5': { name: '(0,1,6) Halbton und Tritonus', family: 1 },
  '3-6': { name: 'Ganztonausschnitt (0,2,4)', family: 2 },
  '3-7': { name: '(0,2,5) diatonischer Dreiton', family: 2 },
  '3-8': { name: '(0,2,6) Dominantsept-Fragment', family: 2 },
  '3-9': { name: '(0,2,7) Quartenstapel', family: 2 },
  '3-10': { name: 'verminderter Dreiklang (0,3,6)', family: 3 },
  '3-11': { name: 'Dur- oder Molldreiklang (0,3,7)', family: 3 },
  '3-12': { name: 'übermäßiger Dreiklang (0,4,8)', family: 3 },
};

function normalOrders(pcs) {
  const s = [...new Set(pcs.map(pc))].sort((a, b) => a - b);
  const n = s.length;
  const rotations = [];
  for (let i = 0; i < n; i++) {
    const rot = s.slice(i).concat(s.slice(0, i));
    const base = rot[0];
    rotations.push(rot.map((x) => (x - base + 12) % 12));
  }
  return rotations;
}

function morePacked(a, b) {
  // Rahn: kleinste Spanne, dann von links gepackt (Vergleich a vs b, true wenn a besser)
  const n = a.length;
  if (a[n - 1] !== b[n - 1]) return a[n - 1] < b[n - 1];
  for (let i = 1; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

function best(rotations) {
  let b = rotations[0];
  for (const r of rotations) if (morePacked(r, b)) b = r;
  return b;
}

/** Primform (Rahn-Verfahren; für Kardinalität 3 und 4 identisch mit Forte). */
export function primeForm(pcs) {
  const nat = best(normalOrders(pcs));
  const inv = best(normalOrders(pcs.map((x) => (12 - pc(x)) % 12)));
  return morePacked(inv, nat) ? inv : nat;
}

export function forteName(pcs) {
  const pf = primeForm(pcs);
  const table = FORTE[pf.length];
  if (!table) return null;
  const key = pf.join(',');
  const hit = table.find(([, f]) => f.join(',') === key);
  return hit ? hit[0] : null;
}

export function pfLabel(pf) {
  return '(' + pf.join(',') + ')';
}

/** Intervallvektor */
export function intervalVector(pcs) {
  const v = [0, 0, 0, 0, 0, 0];
  const s = [...new Set(pcs.map(pc))];
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const d = Math.abs(s[i] - s[j]);
      const ic = Math.min(d, 12 - d);
      if (ic > 0) v[ic - 1]++;
    }
  return v;
}

/** Zufällige Realisierung einer Primform als Tonhöhen in einem Register, aufsteigend, nahe beieinander. */
export function realize(pf, transposition, { bassTarget = 55, spread = 'close' } = {}) {
  const pcs = pf.map((x) => pc(x + transposition));
  const order = spread === 'close' ? pcs.slice() : pcs.slice().sort(() => Math.random() - 0.5);
  let bass = bassTarget + ((order[0] - pc(bassTarget) + 12) % 12);
  if (bass - bassTarget > 6) bass -= 12;
  const midis = [bass];
  for (let k = 1; k < order.length; k++) {
    const prev = midis[k - 1];
    let m = prev + ((order[k] - pc(prev) + 12) % 12);
    if (m === prev) m += 12;
    if (spread === 'wide') m += 12 * (Math.random() < 0.5 ? 1 : 0);
    midis.push(m);
  }
  return midis.sort((a, b) => a - b);
}
