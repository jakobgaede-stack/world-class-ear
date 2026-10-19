// Ansichten: Heute (Tageslektion), Üben (frei), Statistik, Wissen, Einstellungen.
import { el } from '../modules/common.js';
import { state, saveState, exportJson, importJson, todayKey } from '../engine/state.js';
import { SKILLS, SKILL_BY_ID, FAMILY_DE, FAMILY_ORDER, skillsOfFamily } from '../engine/skills.js';
import { skillStats, currentStageIndex, recentAccuracy, topConfusions, overdueDays } from '../engine/rating.js';
import { planLesson, saveLesson, todaysLesson, lessonSummary } from '../engine/lesson.js';
import { runBlock, blockSummary, runPassive, stageLabel, showCard } from './runner.js';
import { allCards } from '../knowledge/cards.js';
import { setMasterVolume } from '../audio/context.js';
import { ENSEMBLES } from '../audio/ensembles.js';
import { pull, push, syncStatus, syncEnabled } from '../engine/sync.js';

function h(container, title, sub) {
  container.appendChild(el('h1', { text: title }));
  if (sub) container.appendChild(el('p', { class: 'muted', text: sub }));
}

// ---------- Heute ----------
export function viewToday(container) {
  container.innerHTML = '';
  const streak = state.streak.current && state.streak.lastDate === todayKey() ? state.streak.current : state.streak.current && isYesterday(state.streak.lastDate) ? state.streak.current : 0;
  h(container, 'Heute', streak ? `Serie: ${streak} Tag${streak === 1 ? '' : 'e'}` : 'Noch keine Serie, heute beginnt sie.');
  let lesson = todaysLesson();
  if (!lesson) {
    const box = el('div', { class: 'panel' });
    box.appendChild(el('h2', { text: 'Tageslektion planen' }));
    box.appendChild(el('p', { text: 'Wie viel Zeit hast du heute?' }));
    const row = el('div', { class: 'row' });
    const input = el('input', { type: 'number', min: 10, max: 240, step: 5, value: state.settings.defaultMinutes || 45, class: 'num' });
    row.appendChild(input);
    row.appendChild(el('span', { text: 'Minuten' }));
    for (const m of [20, 30, 45, 60, 90, 120]) row.appendChild(el('button', { class: 'btn chip', text: m + '′', onclick: () => { input.value = m; } }));
    box.appendChild(row);
    box.appendChild(el('button', { class: 'btn primary', text: 'Lektion erstellen', onclick: () => {
      const minutes = Math.max(10, Math.min(240, Number(input.value) || 45));
      state.settings.defaultMinutes = minutes;
      const plan = planLesson(minutes);
      saveLesson(plan);
      viewToday(container);
    } }));
    container.appendChild(box);
    renderDue(container);
    return;
  }
  renderLesson(container, lesson);
}

function isYesterday(key) {
  if (!key) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return key === todayKey(y);
}

function renderDue(container) {
  const due = SKILLS.map((sk) => ({ sk, s: skillStats(sk.id), od: overdueDays(sk.id) })).filter((x) => x.s.n > 0 && x.od > 0).sort((a, b) => b.od - a.od).slice(0, 6);
  if (!due.length) return;
  const box = el('div', { class: 'panel' });
  box.appendChild(el('h3', { text: 'Fällige Wiederholungen' }));
  for (const d of due) box.appendChild(el('div', { class: 'small', text: `${d.sk.name}: fällig seit ${d.od.toFixed(1)} Tagen` }));
  container.appendChild(box);
}

function renderLesson(container, lesson) {
  const box = el('div', { class: 'panel' });
  box.appendChild(el('h2', { text: `Tageslektion, ${lesson.minutes} Minuten` }));
  const list = el('ol', { class: 'blocks' });
  lesson.blocks.forEach((b, idx) => {
    const li = el('li', { class: idx < lesson.progress ? 'done' : idx === lesson.progress ? 'current' : '' });
    li.appendChild(el('span', { text: lessonSummary(lesson)[idx] }));
    if (b.result) li.appendChild(el('span', { class: 'muted small', text: ` · ${b.result.answers} Items, ${b.result.answers ? Math.round((b.result.score / b.result.answers) * 100) : 0} %` }));
    list.appendChild(li);
  });
  box.appendChild(list);
  const row = el('div', { class: 'row' });
  if (lesson.progress < lesson.blocks.length) {
    row.appendChild(el('button', { class: 'btn primary', text: lesson.progress === 0 ? 'Lektion starten' : 'Weiter mit Block ' + (lesson.progress + 1), onclick: () => startBlock(container, lesson) }));
    row.appendChild(el('button', { class: 'btn ghost', text: 'Block überspringen', onclick: () => { lesson.progress++; saveLesson(lesson); viewToday(container); } }));
  } else {
    box.appendChild(el('p', { class: 'ok', text: 'Lektion abgeschlossen. Freies Weiterüben unter „Üben“.' }));
    row.appendChild(el('button', { class: 'btn', text: 'Neue Lektion planen', onclick: () => { lesson.done = true; saveLesson(lesson); viewToday(container); } }));
  }
  row.appendChild(el('button', { class: 'btn ghost', text: 'Lektion verwerfen', onclick: () => { lesson.done = true; saveLesson(lesson); viewToday(container); } }));
  box.appendChild(row);
  container.appendChild(box);
}

async function startBlock(container, lesson) {
  const block = lesson.blocks[lesson.progress];
  container.innerHTML = '';
  const bar = el('div', { class: 'topbar' }, [
    el('span', { text: `Block ${lesson.progress + 1} von ${lesson.blocks.length}: ${block.label}` }),
    el('button', { class: 'btn ghost small', text: 'Abbrechen', onclick: () => { if (runArea._stop) runArea._stop(); } }),
  ]);
  container.appendChild(bar);
  const runArea = el('div', { class: 'run-area' });
  container.appendChild(runArea);
  let result;
  if (block.kind === 'passive') result = await runPassive(runArea, block);
  else result = await runBlock(runArea, block);
  block.result = { answers: result.answers, score: result.score };
  if (!result.stopped || result.answers > 0) lesson.progress++;
  saveLesson(lesson);
  container.innerHTML = '';
  if (!result.passive) blockSummary(container, block, result);
  container.appendChild(el('button', { class: 'btn primary', text: lesson.progress < lesson.blocks.length ? 'Weiter' : 'Zur Übersicht', onclick: () => viewToday(container) }));
}

// ---------- Üben ----------
export function viewPractice(container, preselect) {
  container.innerHTML = '';
  h(container, 'Üben', 'Jeder Skill einzeln, Stufe frei wählbar. Ergebnisse fließen ins Rating ein.');
  for (const fam of FAMILY_ORDER) {
    const box = el('div', { class: 'panel' });
    box.appendChild(el('h3', { text: FAMILY_DE[fam] }));
    const grid = el('div', { class: 'skill-grid' });
    for (const sk of skillsOfFamily(fam)) {
      const s = skillStats(sk.id);
      const stage = currentStageIndex(sk.id, sk.stages);
      const b = el('button', { class: 'skill-btn', onclick: () => practiceSkill(container, sk) });
      b.appendChild(el('span', { class: 'sk-name', text: sk.name }));
      b.appendChild(el('span', { class: 'sk-meta', text: `Rating ${s.rating.toFixed(0)} · Stufe ${stage + 1}/${sk.stages.length}${s.n ? ' · ' + s.n + ' Items' : ''}` }));
      grid.appendChild(b);
    }
    box.appendChild(grid);
    container.appendChild(box);
  }
  if (preselect && SKILL_BY_ID[preselect]) practiceSkill(container, SKILL_BY_ID[preselect]);
}

function practiceSkill(container, sk) {
  container.innerHTML = '';
  h(container, sk.name);
  const box = el('div', { class: 'panel' });
  const s = skillStats(sk.id);
  const cur = currentStageIndex(sk.id, sk.stages);
  box.appendChild(el('p', { class: 'muted', text: `Rating ${s.rating.toFixed(1)} · aktuelle Stufe ${cur + 1} · ${s.n} Items bisher` }));
  box.appendChild(el('div', { class: 'group-title', text: 'Stufe' }));
  const sel = el('select', { class: 'select' });
  sel.appendChild(el('option', { value: 'auto', text: `automatisch (adaptiv, zurzeit Stufe ${cur + 1})` }));
  sk.stages.forEach((st, i) => sel.appendChild(el('option', { value: String(i), text: `Stufe ${i + 1}: ${st.label}` })));
  box.appendChild(sel);
  box.appendChild(el('div', { class: 'group-title', text: 'Anzahl' }));
  const n = el('select', { class: 'select' });
  for (const v of [10, 20, 30, 50]) n.appendChild(el('option', { value: String(v), text: v + ' Items' }));
  n.appendChild(el('option', { value: 'free', text: 'offen (bis Abbruch)' }));
  box.appendChild(n);
  const row = el('div', { class: 'row' });
  row.appendChild(el('button', { class: 'btn primary', text: 'Start', onclick: async () => {
    const block = { kind: 'skill', label: 'Freies Üben', skill: sk.id, items: n.value === 'free' ? Infinity : Number(n.value), free: n.value === 'free', mode: 'normal', stageOverride: sel.value === 'auto' ? null : Number(sel.value) };
    container.innerHTML = '';
    const bar = el('div', { class: 'topbar' }, [el('span', { text: `Freies Üben: ${sk.name}` }), el('button', { class: 'btn ghost small', text: 'Beenden', onclick: () => { if (runArea._stop) runArea._stop(); } })]);
    container.appendChild(bar);
    const runArea = el('div', { class: 'run-area' });
    container.appendChild(runArea);
    const result = await runBlock(runArea, block);
    container.innerHTML = '';
    blockSummary(container, block, result);
    container.appendChild(el('button', { class: 'btn primary', text: 'Zurück', onclick: () => viewPractice(container) }));
  } }));
  row.appendChild(el('button', { class: 'btn ghost', text: 'Zurück', onclick: () => viewPractice(container) }));
  box.appendChild(row);
  container.appendChild(box);
  // Stufenübersicht
  const st = el('div', { class: 'panel' });
  st.appendChild(el('h3', { text: 'Stufen' }));
  sk.stages.forEach((x, i) => st.appendChild(el('div', { class: 'small' + (i === cur ? ' current' : ''), text: `${i + 1}. ${x.label} (Schwierigkeit ${x.diff})` })));
  container.appendChild(st);
}

// ---------- Statistik ----------
export function viewStats(container) {
  container.innerHTML = '';
  h(container, 'Statistik', `${state.answers.length} Antworten gesamt · Serie ${state.streak.current || 0} · ${state.lessons.filter((l) => l.done || l.progress >= l.blocks.length).length} Lektionen`);
  for (const fam of FAMILY_ORDER) {
    const box = el('div', { class: 'panel' });
    box.appendChild(el('h3', { text: FAMILY_DE[fam] }));
    const table = el('table', { class: 'stats' });
    table.appendChild(el('tr', {}, ['Skill', 'Rating', 'Stufe', 'Items', 'Heute', 'Quote (20)', 'Fällig'].map((t) => el('th', { text: t }))));
    for (const sk of skillsOfFamily(fam)) {
      const s = skillStats(sk.id);
      const acc = recentAccuracy(sk.id, 20);
      const stage = currentStageIndex(sk.id, sk.stages);
      const od = overdueDays(sk.id);
      const tr = el('tr', {}, [
        el('td', {}, el('a', { href: '#ueben/' + sk.id, text: sk.name })),
        el('td', { text: s.rating.toFixed(1) }),
        el('td', { text: `${stage + 1}/${sk.stages.length}` }),
        el('td', { text: String(s.n) }),
        el('td', { text: s.todayCount ? `${s.todayCorrect}/${s.todayCount}` : '–' }),
        el('td', { text: acc === null ? '–' : Math.round(acc * 100) + ' %' }),
        el('td', { text: s.n === 0 ? 'neu' : od > 0 ? `seit ${od.toFixed(1)} d` : `in ${(-od).toFixed(1)} d` }),
      ]);
      table.appendChild(tr);
      const conf = topConfusions(sk.id, 4);
      if (conf.length) {
        const ctr = el('tr', { class: 'conf' });
        ctr.appendChild(el('td', { colspan: '7', text: 'Verwechslungen: ' + conf.map((c) => `${c.truth} → ${c.answer} (${c.count}×)`).join(' · ') }));
        table.appendChild(ctr);
      }
    }
    box.appendChild(table);
    container.appendChild(box);
  }
  // Verlauf der letzten 14 Tage
  const days = {};
  for (const a of state.answers) {
    const k = todayKey(new Date(a.t));
    days[k] = days[k] || { n: 0, s: 0 };
    days[k].n++;
    days[k].s += a.score;
  }
  const keys = Object.keys(days).sort().slice(-14);
  if (keys.length) {
    const box = el('div', { class: 'panel' });
    box.appendChild(el('h3', { text: 'Letzte Tage' }));
    for (const k of keys) box.appendChild(el('div', { class: 'small', text: `${k}: ${days[k].n} Items, ${Math.round((days[k].s / days[k].n) * 100)} %` }));
    container.appendChild(box);
  }
}

// ---------- Wissen ----------
export function viewKnowledge(container) {
  container.innerHTML = '';
  h(container, 'Hintergrundwissen', 'Karten zu Intervallen, Akkorden, Setklassen, Fehlerarten und Balance. Nichts davon wird abgefragt.');
  const search = el('input', { type: 'search', placeholder: 'Suchen …', class: 'search' });
  container.appendChild(search);
  const list = el('div', { class: 'cards' });
  container.appendChild(list);
  const render = () => {
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    for (const c of allCards()) {
      if (q && !(c.title + ' ' + c.body).toLowerCase().includes(q)) continue;
      const item = el('div', { class: 'card-item', onclick: () => showCard(c.id) });
      item.appendChild(el('b', { text: c.title }));
      item.appendChild(el('div', { class: 'small muted', text: c.body.slice(0, 140) + '…' }));
      list.appendChild(item);
    }
  };
  search.addEventListener('input', render);
  render();
}

// ---------- Einstellungen ----------
export function viewSettings(container) {
  container.innerHTML = '';
  h(container, 'Einstellungen');
  const box = el('div', { class: 'panel' });
  const field = (label, input) => box.appendChild(el('label', { class: 'field' }, [el('span', { text: label }), input]));
  const minutes = el('input', { type: 'number', min: 10, max: 240, value: state.settings.defaultMinutes || 45, class: 'num' });
  minutes.addEventListener('change', () => { state.settings.defaultMinutes = Number(minutes.value); saveState(); });
  field('Standard-Zeitbudget (Minuten)', minutes);
  const bpm = el('input', { type: 'number', min: 40, max: 120, value: state.settings.bpmChorale || 66, class: 'num' });
  bpm.addEventListener('change', () => { state.settings.bpmChorale = Number(bpm.value); saveState(); });
  field('Choraltempo (Viertel pro Minute)', bpm);
  const vol = el('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: state.settings.volume ?? 0.7 });
  vol.addEventListener('input', () => { state.settings.volume = Number(vol.value); setMasterVolume(Number(vol.value)); saveState(); });
  field('Lautstärke', vol);
  const hold = el('select', { class: 'select', style: 'width:auto;margin:0' });
  for (const [v, t] of [['new', 'bei neuen Stufen (gehaltene Akkorde)'], ['always', 'immer'], ['never', 'nie']]) {
    const o = el('option', { value: v, text: t });
    if ((state.settings.holdMode || 'new') === v) o.setAttribute('selected', 'selected');
    hold.appendChild(o);
  }
  hold.addEventListener('change', () => { state.settings.holdMode = hold.value; saveState(); });
  field('Akkorde halten bis zur Antwort', hold);
  container.appendChild(box);
  const sync = el('div', { class: 'panel' });
  sync.appendChild(el('h3', { text: 'Sync zwischen Geräten' }));
  sync.appendChild(el('p', { class: 'small muted', text: 'Gib auf jedem Gerät denselben Sync-Schlüssel ein (mindestens 6 Zeichen, frei wählbar). Der Fortschritt wird dann automatisch zusammengeführt; Ablage: Cloudflare D1, kostenloser Tarif.' }));
  const keyIn = el('input', { type: 'text', class: 'num', style: 'width:260px', value: state.settings.syncKey || '', placeholder: 'Sync-Schlüssel' });
  const status = el('span', { class: 'small muted', text: state.settings.syncLast ? 'zuletzt ' + new Date(state.settings.syncLast).toLocaleString('de-AT') : (syncEnabled() ? 'noch nicht synchronisiert' : 'aus') });
  syncStatus((m) => { status.textContent = m; });
  const srow = el('div', { class: 'row' });
  srow.appendChild(keyIn);
  srow.appendChild(el('button', { class: 'btn primary', text: 'Speichern und abgleichen', onclick: async () => {
    state.settings.syncKey = keyIn.value.trim();
    saveState();
    if (!syncEnabled()) { status.textContent = 'Schlüssel zu kurz (mindestens 6 Zeichen)'; return; }
    status.textContent = 'hole …';
    const ok = await pull();
    if (ok) { status.textContent = 'schicke …'; await push(); }
  } }));
  srow.appendChild(el('button', { class: 'btn ghost', text: 'Sync aus', onclick: () => { state.settings.syncKey = ''; saveState(); keyIn.value = ''; status.textContent = 'aus'; } }));
  srow.appendChild(status);
  sync.appendChild(srow);
  container.appendChild(sync);
  const data = el('div', { class: 'panel' });
  data.appendChild(el('h3', { text: 'Daten' }));
  data.appendChild(el('p', { class: 'small muted', text: 'Der Fortschritt liegt im Browser dieses Geräts. Export als JSON-Datei zur Sicherung oder zum Übertragen auf ein anderes Gerät.' }));
  const row = el('div', { class: 'row' });
  row.appendChild(el('button', { class: 'btn', text: 'Export (JSON)', onclick: () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `world-class-ear-${todayKey()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
  } }));
  const file = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try { await importJson(await f.text()); alert('Import abgeschlossen.'); location.reload(); } catch (e) { alert('Import fehlgeschlagen: ' + e.message); }
  });
  row.appendChild(el('button', { class: 'btn', text: 'Import (JSON)', onclick: () => file.click() }));
  row.appendChild(file);
  row.appendChild(el('button', { class: 'btn danger', text: 'Alles zurücksetzen', onclick: () => { if (confirm('Wirklich alle Ratings und Antworten löschen?')) { indexedDB.deleteDatabase('world-class-ear'); localStorage.clear(); location.reload(); } } }));
  data.appendChild(row);
  container.appendChild(data);
  const info = el('div', { class: 'panel' });
  info.appendChild(el('h3', { text: 'Technik' }));
  info.appendChild(el('p', { class: 'small muted', text: 'Empfohlen: Chrome auf dem Mac (Web MIDI). Klänge: VSCO-2 Community Edition (CC0) und FluidR3 (MIT). Choräle: music21-Korpus (Riemenschneider). Notensatz: VexFlow (MIT).' }));
  container.appendChild(info);
}
