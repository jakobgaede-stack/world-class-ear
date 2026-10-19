// Adaptive Engine: Rating je Skill (Elo-Logik), Stufenwahl, Konfusionsmatrix, Spacing.
import { state, saveState, todayKey } from './state.js';

const START_RATING = 22;
const TARGET_OFFSET = 12; // Zielschwierigkeit = Rating - 12 entspricht 80 % Trefferquote
const SPACING_DAYS = [1, 2, 4, 7, 14];

export function expected(rating, diff) {
  return 1 / (1 + Math.pow(10, (diff - rating) / 20));
}

export function skillStats(skillId) {
  if (!state.skills[skillId]) {
    state.skills[skillId] = {
      rating: START_RATING,
      n: 0,
      history: [],
      lastPracticed: null,
      stability: 0,
      dueAt: 0,
      todayDate: null,
      todayCount: 0,
      todayCorrect: 0,
      avgMs: null,
    };
  }
  const s = state.skills[skillId];
  const tk = todayKey();
  if (s.todayDate !== tk) {
    s.todayDate = tk;
    s.todayCount = 0;
    s.todayCorrect = 0;
  }
  return s;
}

function kFactor(n) {
  if (n < 10) return 8;
  if (n < 40) return 4;
  return 2.5;
}

/**
 * Stufe für das nächste Item wählen.
 * stages: Array mit {diff}. Rückgabe: Index.
 * mode: 'normal' (70/15/15), 'test' (nur Zielstufe), 'easy', 'hard'
 */
export function chooseStage(skillId, stages, mode = 'normal') {
  const s = skillStats(skillId);
  const target = s.rating - TARGET_OFFSET;
  let best = 0;
  let bestD = Infinity;
  stages.forEach((st, i) => {
    const d = Math.abs(st.diff - target);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (mode === 'test') return best;
  const r = Math.random();
  if (r < 0.15 && best > 0) return best - 1;
  if (r > 0.85 && best < stages.length - 1) return best + 1;
  return best;
}

/** Aktuelle Stufe (für Anzeige) */
export function currentStageIndex(skillId, stages) {
  const s = skillStats(skillId);
  const target = s.rating - TARGET_OFFSET;
  let best = 0;
  let bestD = Infinity;
  stages.forEach((st, i) => {
    const d = Math.abs(st.diff - target);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * Antwort verbuchen.
 * rec: { skill, stage, diff, score (0..1), truth, answer, ms, weight (Test=2), meta }
 */
export function recordAnswer(rec) {
  const s = skillStats(rec.skill);
  const p = expected(s.rating, rec.diff);
  const k = kFactor(s.n) * (rec.weight || 1);
  s.rating = Math.max(0, Math.min(100, s.rating + k * (rec.score - p)));
  s.n++;
  s.todayCount++;
  if (rec.score >= 0.75) s.todayCorrect++;
  s.lastPracticed = Date.now();
  s.history.push({ t: Date.now(), score: Math.round(rec.score * 100) / 100, diff: rec.diff, r: Math.round(s.rating * 10) / 10 });
  if (s.history.length > 300) s.history.splice(0, s.history.length - 300);
  if (rec.ms) s.avgMs = s.avgMs ? s.avgMs * 0.9 + rec.ms * 0.1 : rec.ms;
  // Konfusionsmatrix
  if (rec.truth !== undefined && rec.answer !== undefined) {
    const cm = (state.confusion[rec.skill] ||= {});
    const row = (cm[rec.truth] ||= {});
    row[rec.answer] = (row[rec.answer] || 0) + 1;
  }
  state.answers.push({
    t: Date.now(),
    skill: rec.skill,
    stage: rec.stage,
    diff: rec.diff,
    score: rec.score,
    truth: rec.truth,
    answer: rec.answer,
    ms: rec.ms,
    meta: rec.meta || null,
  });
  if (state.answers.length > 6000) state.answers.splice(0, state.answers.length - 6000);
  updateStreak();
  saveState();
  return s;
}

function updateStreak() {
  const tk = todayKey();
  const st = state.streak;
  if (st.lastDate === tk) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  st.current = st.lastDate === todayKey(y) ? st.current + 1 : 1;
  st.lastDate = tk;
}

/** Nach einem Block: Spacing anpassen (Trefferquote der letzten 20 Antworten) */
export function closeBlock(skillId) {
  const s = skillStats(skillId);
  const recent = s.history.slice(-20);
  if (recent.length < 10) {
    s.stability = 0;
    s.dueAt = Date.now() + 86400000;
    saveState();
    return;
  }
  const acc = recent.reduce((a, h) => a + h.score, 0) / recent.length;
  if (acc >= 0.8) {
    const idx = SPACING_DAYS.indexOf(s.stability);
    s.stability = SPACING_DAYS[Math.min(idx + 1, SPACING_DAYS.length - 1)] || 1;
  } else if (acc < 0.7) {
    s.stability = 1;
  } else {
    s.stability = s.stability || 1;
  }
  s.dueAt = Date.now() + s.stability * 86400000;
  saveState();
}

/** Trefferquote der letzten n Antworten */
export function recentAccuracy(skillId, n = 20) {
  const s = skillStats(skillId);
  const recent = s.history.slice(-n);
  if (!recent.length) return null;
  return recent.reduce((a, h) => a + h.score, 0) / recent.length;
}

/** Die häufigsten Verwechslungen eines Skills: [{truth, answer, count}] */
export function topConfusions(skillId, limit = 3) {
  const cm = state.confusion[skillId] || {};
  const list = [];
  for (const truth of Object.keys(cm))
    for (const answer of Object.keys(cm[truth]))
      if (truth !== answer) list.push({ truth, answer, count: cm[truth][answer] });
  list.sort((a, b) => b.count - a.count);
  return list.slice(0, limit);
}

export function overdueDays(skillId) {
  const s = skillStats(skillId);
  if (!s.lastPracticed) return 3;
  return Math.max(0, (Date.now() - s.dueAt) / 86400000);
}

export { TARGET_OFFSET, START_RATING };
