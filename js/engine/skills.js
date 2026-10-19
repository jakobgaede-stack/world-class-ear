// Skill-Registry: alle Übungsmodule an einem Ort.
import { SKILLS as INTERVALS } from '../modules/intervals.js';
import { SKILLS as CHORDS } from '../modules/chords.js';
import { SKILLS as CLUSTERS } from '../modules/clusters.js';
import { SKILLS as ERRORS } from '../modules/errors.js';
import { SKILLS as BALANCE } from '../modules/balance.js';

export const FAMILY_DE = {
  intervals: 'Intervalle',
  chords: 'Akkorde und Cluster',
  errors: 'Fehlerhören',
  balance: 'Balance',
};

export const FAMILY_ORDER = ['intervals', 'chords', 'errors', 'balance'];

export const SKILLS = [...INTERVALS, ...CHORDS, ...CLUSTERS, ...ERRORS, ...BALANCE];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function skillsOfFamily(f) {
  return SKILLS.filter((s) => s.family === f);
}
