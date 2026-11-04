// Skill-Registry: alle Übungsmodule an einem Ort.
import { SKILLS as INTERVALS } from '../modules/intervals.js';
import { SKILLS as CHORDS } from '../modules/chords.js';
import { SKILLS as CLUSTERS } from '../modules/clusters.js';
import { SKILLS as ERRORS } from '../modules/errors.js';
import { SKILLS as BALANCE } from '../modules/balance.js';
import { SKILLS as DICTATION } from '../modules/dictation.js';
import { SKILLS as SINGING } from '../modules/singing.js';
import { SKILLS as HARMONY } from '../modules/progressions.js';
import { SKILLS as ORCHESTRA } from '../modules/orchestra.js';

export const FAMILY_DE = {
  intervals: 'Intervalle',
  chords: 'Akkorde und Cluster',
  harmony: 'Akkordfolgen und Modulation',
  errors: 'Fehlerhören',
  balance: 'Balance',
  dictation: 'Diktat',
  singing: 'Blattsingen',
};

export const FAMILY_ORDER = ['intervals', 'chords', 'harmony', 'errors', 'balance', 'dictation', 'singing'];

export const SKILLS = [...INTERVALS, ...CHORDS, ...CLUSTERS, ...HARMONY, ...ERRORS, ...ORCHESTRA, ...BALANCE, ...DICTATION, ...SINGING];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function skillsOfFamily(f) {
  return SKILLS.filter((s) => s.family === f);
}
