// Sync: Fortschritt an die Cloudflare-Ablage schicken und von dort holen (Zusammenführen statt Überschreiben).
import { state, saveState, onChange } from './state.js';

export const SYNC_URL = 'https://world-class-ear-sync.jakobgaede.workers.dev/state';
let pushTimer = null;
let busy = false;
const listeners = new Set();

export function syncStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function tell(msg) { for (const fn of listeners) fn(msg); }

function enabled() { return !!(state.settings.syncKey && state.settings.syncKey.length >= 6); }

function mergeSkills(a, b) {
  const out = { ...a };
  for (const [id, s] of Object.entries(b || {})) {
    const cur = out[id];
    if (!cur || (s.n || 0) > (cur.n || 0) || ((s.n || 0) === (cur.n || 0) && (s.lastPracticed || 0) > (cur.lastPracticed || 0))) out[id] = s;
  }
  return out;
}

function mergeConfusion(a, b) {
  const out = JSON.parse(JSON.stringify(a || {}));
  for (const [skill, rows] of Object.entries(b || {})) {
    out[skill] = out[skill] || {};
    for (const [truth, cols] of Object.entries(rows)) {
      out[skill][truth] = out[skill][truth] || {};
      for (const [ans, n] of Object.entries(cols)) out[skill][truth][ans] = Math.max(out[skill][truth][ans] || 0, n);
    }
  }
  return out;
}

function mergeAnswers(a, b) {
  const seen = new Set();
  const all = [];
  for (const x of [...(a || []), ...(b || [])]) {
    const k = x.t + '|' + x.skill;
    if (seen.has(k)) continue;
    seen.add(k);
    all.push(x);
  }
  all.sort((x, y) => x.t - y.t);
  return all.slice(-6000);
}

function mergeLessons(a, b) {
  const byDate = {};
  for (const l of [...(a || []), ...(b || [])]) {
    const cur = byDate[l.date];
    if (!cur || (l.progress || 0) > (cur.progress || 0) || (l.done && !cur.done)) byDate[l.date] = l;
  }
  return Object.values(byDate).sort((x, y) => (x.date < y.date ? -1 : 1)).slice(-120);
}

/** Entfernten Zustand in den lokalen einarbeiten (lokale Einstellungen und Sync-Schlüssel bleiben). */
export function mergeRemote(remote) {
  if (!remote || typeof remote !== 'object') return;
  state.skills = mergeSkills(state.skills, remote.skills);
  state.confusion = mergeConfusion(state.confusion, remote.confusion);
  state.answers = mergeAnswers(state.answers, remote.answers);
  state.lessons = mergeLessons(state.lessons, remote.lessons);
  if (remote.streak && (remote.streak.lastDate || '') > (state.streak.lastDate || '')) state.streak = remote.streak;
  else if (remote.streak && remote.streak.lastDate === state.streak.lastDate) state.streak.current = Math.max(state.streak.current || 0, remote.streak.current || 0);
}

async function request(method, body) {
  const res = await fetch(SYNC_URL, { method, headers: { 'X-WCE-Key': state.settings.syncKey, 'Content-Type': 'application/json' }, body });
  if (!res.ok) throw new Error('Sync-Server antwortet mit ' + res.status);
  return res.json();
}

export async function pull() {
  if (!enabled() || busy) return false;
  busy = true;
  try {
    const r = await request('GET');
    if (r.data) { mergeRemote(r.data); saveState(); }
    state.settings.syncLast = Date.now();
    tell('Sync geholt');
    return true;
  } catch (e) {
    tell('Sync fehlgeschlagen: ' + e.message);
    return false;
  } finally { busy = false; }
}

export async function push() {
  if (!enabled() || busy) return false;
  busy = true;
  try {
    const { settings, ...rest } = state;
    await request('PUT', JSON.stringify(rest));
    state.settings.syncLast = Date.now();
    tell('Sync gespeichert');
    return true;
  } catch (e) {
    tell('Sync fehlgeschlagen: ' + e.message);
    return false;
  } finally { busy = false; }
}

export function schedulePush() {
  if (!enabled()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 4000);
}

/** Beim Start: holen, danach bei jeder Änderung verzögert schicken. */
export async function initSync() {
  onChange(() => schedulePush());
  if (enabled()) await pull();
}

export { enabled as syncEnabled };
