// Intervalle bis zur Doppeloktave.

export const INTERVALS = [
  { semi: 0, abbr: 'r1', name: 'Prime' },
  { semi: 1, abbr: 'k2', name: 'kleine Sekunde' },
  { semi: 2, abbr: 'g2', name: 'große Sekunde' },
  { semi: 3, abbr: 'k3', name: 'kleine Terz' },
  { semi: 4, abbr: 'g3', name: 'große Terz' },
  { semi: 5, abbr: 'r4', name: 'reine Quarte' },
  { semi: 6, abbr: 'TT', name: 'Tritonus' },
  { semi: 7, abbr: 'r5', name: 'reine Quinte' },
  { semi: 8, abbr: 'k6', name: 'kleine Sexte' },
  { semi: 9, abbr: 'g6', name: 'große Sexte' },
  { semi: 10, abbr: 'k7', name: 'kleine Septime' },
  { semi: 11, abbr: 'g7', name: 'große Septime' },
  { semi: 12, abbr: 'r8', name: 'Oktave' },
  { semi: 13, abbr: 'k9', name: 'kleine None' },
  { semi: 14, abbr: 'g9', name: 'große None' },
  { semi: 15, abbr: 'k10', name: 'kleine Dezime' },
  { semi: 16, abbr: 'g10', name: 'große Dezime' },
  { semi: 17, abbr: 'r11', name: 'Undezime' },
  { semi: 18, abbr: 'üb11', name: 'übermäßige Undezime' },
  { semi: 19, abbr: 'r12', name: 'Duodezime' },
  { semi: 20, abbr: 'k13', name: 'kleine Tredezime' },
  { semi: 21, abbr: 'g13', name: 'große Tredezime' },
  { semi: 22, abbr: 'k14', name: 'kleine Quartdezime' },
  { semi: 23, abbr: 'g14', name: 'große Quartdezime' },
  { semi: 24, abbr: 'r15', name: 'Doppeloktave' },
];

export function intervalBySemi(semi) {
  return INTERVALS[Math.abs(semi)] || null;
}

export function intervalName(semi) {
  const iv = intervalBySemi(semi);
  return iv ? iv.name : semi + ' Halbtöne';
}

/** Intervallklasse 0..6 */
export function intervalClass(semi) {
  const p = ((semi % 12) + 12) % 12;
  return Math.min(p, 12 - p);
}
