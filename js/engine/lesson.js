// Tageslektion: baut aus Zeitbudget und Skill-Zustand die Blockfolge.
import { SKILLS, SKILL_BY_ID } from './skills.js';
import { skillStats, overdueDays, topConfusions, recentAccuracy } from './rating.js';
import { state, saveState, todayKey } from './state.js';

function priority(skill) {
  const s = skillStats(skill.id);
  const overdue = overdueDays(skill.id);
  const weakness = (100 - s.rating) / 25;
  const unseen = s.n === 0 ? 2 : 0;
  const todayPenalty = s.todayCount >= skill.dailyMin ? 3 : s.todayCount > 0 ? 1 : 0;
  const errorsBoost = skill.family === 'errors' ? 1.5 : 0;
  return overdue * 1.5 + weakness + unseen + errorsBoost + skill.importance - todayPenalty + Math.random() * 0.4;
}

function itemsFor(skill, minutes) {
  const s = skillStats(skill.id);
  const sec = s.avgMs ? Math.max(4, s.avgMs / 1000) : skill.itemSeconds;
  const n = Math.round((minutes * 60) / sec);
  return Math.max(4, Math.min(skill.dailyMax, n));
}

/** Blockplan erzeugen. Rückgabe: { minutes, blocks: [{kind, skill, minutes, items, mode}] } */
export function planLesson(minutes) {
  const M = Math.max(10, Math.min(240, minutes));
  const blocks = [];
  const used = new Set();
  const ranked = SKILLS.map((sk) => ({ sk, p: priority(sk) })).sort((a, b) => b.p - a.p);
  const pickSkill = (filter) => {
    const hit = ranked.find((r) => !used.has(r.sk.id) && (!filter || filter(r.sk)));
    if (hit) used.add(hit.sk.id);
    return hit ? hit.sk : null;
  };
  // Aufwärmen: schnelle Intervall- oder Akkordübung
  const warmMin = Math.max(3, Math.round(M * 0.1));
  const warm = pickSkill((sk) => ['int_mel', 'int_harm', 'ch_triads', 'ch_sevenths'].includes(sk.id));
  if (warm) blocks.push({ kind: 'skill', label: 'Aufwärmen', skill: warm.id, minutes: warmMin, items: Math.min(itemsFor(warm, warmMin), 16), mode: 'easy' });
  // Hauptskill 1 (bevorzugt Fehlerhören)
  const m1 = Math.round(M * 0.25);
  const main1 = pickSkill((sk) => sk.family === 'errors') || pickSkill();
  if (main1) blocks.push({ kind: 'skill', label: 'Hauptskill 1', skill: main1.id, minutes: m1, items: itemsFor(main1, m1), mode: 'normal' });
  // Passives Hören
  const pMin = Math.max(2, Math.round(M * (M >= 60 ? 0.15 : 0.1)));
  blocks.push({ kind: 'passive', label: 'Passives Hören', minutes: pMin, phrases: Math.max(2, Math.round(pMin * 1.6)) });
  // Hauptskill 2 (andere Familie)
  const m2 = Math.round(M * 0.2);
  const main2 = pickSkill((sk) => sk.family !== main1?.family) || pickSkill();
  if (main2) blocks.push({ kind: 'skill', label: 'Hauptskill 2', skill: main2.id, minutes: m2, items: itemsFor(main2, m2), mode: 'normal' });
  // Hauptskill 3
  if (M >= 45) {
    const m3 = Math.round(M * 0.15);
    const main3 = pickSkill((sk) => sk.family !== main2?.family) || pickSkill();
    if (main3) blocks.push({ kind: 'skill', label: 'Hauptskill 3', skill: main3.id, minutes: m3, items: itemsFor(main3, m3), mode: 'normal' });
  }
  // Schwächenblock: Skill mit den häufigsten Verwechslungen
  const wMin = Math.max(2, Math.round(M * 0.1));
  const withConf = SKILLS.map((sk) => ({ sk, c: topConfusions(sk.id, 3) })).filter((x) => x.c.length && x.c[0].count >= 2).sort((a, b) => b.c[0].count - a.c[0].count);
  if (withConf.length) {
    const w = withConf[0];
    blocks.push({ kind: 'skill', label: 'Schwächen', skill: w.sk.id, minutes: wMin, items: Math.min(itemsFor(w.sk, wMin), 14), mode: 'normal', focus: w.c });
  } else {
    const alt = pickSkill();
    if (alt) blocks.push({ kind: 'skill', label: 'Ergänzung', skill: alt.id, minutes: wMin, items: Math.min(itemsFor(alt, wMin), 14), mode: 'normal' });
  }
  // Test: gemischte Items der Hauptskills
  const tMin = Math.max(2, Math.round(M * 0.1));
  const testSkills = [main1, main2].filter(Boolean).map((s) => s.id);
  if (testSkills.length) blocks.push({ kind: 'test', label: 'Test', skills: testSkills, minutes: tMin, items: Math.max(4, Math.round((tMin * 60) / 12)), mode: 'test' });
  const plan = { date: todayKey(), minutes: M, blocks, createdAt: Date.now(), done: false, progress: 0 };
  return plan;
}

export function saveLesson(plan) {
  const idx = state.lessons.findIndex((l) => l.date === plan.date && !l.done);
  if (idx >= 0) state.lessons[idx] = plan;
  else state.lessons.push(plan);
  if (state.lessons.length > 120) state.lessons.splice(0, state.lessons.length - 120);
  saveState();
}

export function todaysLesson() {
  return state.lessons.find((l) => l.date === todayKey() && !l.done) || null;
}

export function lessonSummary(plan) {
  return plan.blocks.map((b) => {
    if (b.kind === 'passive') return `${b.label}: ${b.minutes} min`;
    if (b.kind === 'test') return `${b.label}: ${b.skills.map((s) => SKILL_BY_ID[s]?.name).join(', ')} · ${b.minutes} min`;
    return `${b.label}: ${SKILL_BY_ID[b.skill]?.name} · ${b.minutes} min`;
  });
}

export { recentAccuracy };
