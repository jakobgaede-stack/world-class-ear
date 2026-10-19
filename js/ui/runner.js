// Runner: führt einen Block (Items eines Skills, Test, passives Hören) aus.
import { el } from '../modules/common.js';
import { SKILL_BY_ID } from '../engine/skills.js';
import { chooseStage, recordAnswer, closeBlock, skillStats, currentStageIndex, recentAccuracy } from '../engine/rating.js';
import { getCard } from '../knowledge/cards.js';
import { stopAll, ensureAudio } from '../audio/sampler.js';
import { runPassive } from './passive.js';
import { state } from '../engine/state.js';

function stageLabel(skill, idx) {
  return `Stufe ${idx + 1} von ${skill.stages.length}: ${skill.stages[idx].label}`;
}

export function showCard(cardId, anchorContainer) {
  const card = getCard(cardId);
  if (!card) return;
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const box = el('div', { class: 'card-box' });
  box.appendChild(el('h3', { text: card.title }));
  box.appendChild(el('p', { text: card.body }));
  if (card.src?.length) box.appendChild(el('p', { class: 'muted small', text: 'Quellen: ' + card.src.join(' · ') }));
  box.appendChild(el('div', { class: 'row-right' }, el('button', { class: 'btn', text: 'Schließen', onclick: () => overlay.remove() })));
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/**
 * Block ausführen.
 * block: { kind:'skill'|'test', skill | skills, items, mode, focus, free (bool: ohne Ende), stageOverride }
 * Rückgabe: Promise<{answers, correct, ratingDelta}>
 */
export function runBlock(container, block, { onProgress } = {}) {
  return new Promise(async (resolve) => {
    await ensureAudio();
    const results = { answers: 0, score: 0, perSkill: {} };
    const startRatings = {};
    const skillIds = block.kind === 'test' ? block.skills : [block.skill];
    for (const id of skillIds) startRatings[id] = skillStats(id).rating;
    let i = 0;
    let stopped = false;
    const header = el('div', { class: 'run-header' });
    const body = el('div', { class: 'run-body' });
    container.innerHTML = '';
    container.appendChild(header);
    container.appendChild(body);

    const finish = () => {
      stopAll();
      for (const id of skillIds) closeBlock(id);
      const deltas = {};
      for (const id of skillIds) deltas[id] = skillStats(id).rating - startRatings[id];
      resolve({ ...results, deltas, stopped });
    };

    const nextItem = async () => {
      if (!block.free && i >= block.items) return finish();
      const skillId = block.kind === 'test' ? skillIds[i % skillIds.length] : block.skill;
      const skill = SKILL_BY_ID[skillId];
      const stageIdx = block.stageOverride !== undefined && block.stageOverride !== null ? block.stageOverride : chooseStage(skillId, skill.stages, block.mode === 'test' ? 'test' : 'normal');
      header.innerHTML = '';
      header.appendChild(el('div', { class: 'run-title' }, [
        el('span', { class: 'run-skill', text: skill.name }),
        el('span', { class: 'run-count', text: block.free ? `Item ${i + 1}` : `Item ${i + 1} / ${block.items}` }),
      ]));
      header.appendChild(el('div', { class: 'run-stage muted small', text: stageLabel(skill, stageIdx) + (block.mode === 'test' ? ' · Test (zählt doppelt, kein Nachhören)' : '') }));
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'loading', text: 'Item wird vorbereitet …' }));
      let item;
      try {
        item = await skill.generate(stageIdx, { mode: block.mode, focus: block.focus });
        if (block.ensemble) item.hint = item.hint; // Platzhalter für spätere Überschreibungen
        await item.load((p) => { const l = body.querySelector('.loading'); if (l) l.textContent = `Klänge laden … ${Math.round(p * 100)} %`; });
      } catch (e) {
        console.error(e);
        body.innerHTML = '';
        body.appendChild(el('div', { class: 'error', text: 'Item konnte nicht erzeugt werden: ' + e.message }));
        body.appendChild(el('button', { class: 'btn', text: 'Nächstes Item', onclick: () => { i++; nextItem(); } }));
        return;
      }
      if (stopped) return;
      renderItem(skill, item, stageIdx);
    };

    const renderItem = (skill, item, stageIdx) => {
      body.innerHTML = '';
      const top = el('div', { class: 'item-top' });
      top.appendChild(el('h2', { text: item.title }));
      if (item.hint) top.appendChild(el('div', { class: 'hint', text: item.hint }));
      body.appendChild(top);
      if (item.renderPrompt) {
        const promptBox = el('div', { class: 'prompt-box' });
        body.appendChild(promptBox);
        try { item.renderPrompt(promptBox); } catch (e) { console.error(e); promptBox.appendChild(el('div', { class: 'error', text: 'Notendarstellung fehlgeschlagen: ' + e.message })); }
      }
      const controls = el('div', { class: 'controls' });
      let replays = block.mode === 'test' ? 0 : item.replays || 0;
      let playing = null;
      let playedAt = 0;
      let played = 0;
      const playBtn = el('button', { class: 'btn play', text: '▶ Abspielen' });
      const replayInfo = el('span', { class: 'muted small', text: replays ? `${replays}× Wiederholung möglich` : 'ein Durchgang' });
      const doPlay = () => {
        if (playing && playing.hold) {
          // Halten läuft: Taste stoppt
          playing.stop();
          playing = null;
          playBtn.textContent = '▶ Weiter halten';
          return;
        }
        if (played > 0 && replays <= 0 && !(item.holdable)) return;
        if (played > 0 && !item.holdable) { replays--; replayInfo.textContent = replays ? `${replays}× Wiederholung möglich` : 'keine Wiederholung mehr'; }
        played++;
        if (playing) playing.stop();
        playing = item.play();
        if (!playedAt) playedAt = performance.now();
        if (playing && playing.hold) {
          item.holdable = true;
          playBtn.textContent = '■ Stopp';
          replayInfo.textContent = 'klingt, bis du antwortest oder stoppst';
          return;
        }
        playBtn.textContent = played > 0 && replays <= 0 ? '▶ gespielt' : '▶ Nochmal';
        if (played > 0 && replays <= 0) playBtn.setAttribute('disabled', 'disabled');
      };
      playBtn.addEventListener('click', doPlay);
      controls.appendChild(playBtn);
      controls.appendChild(replayInfo);
      if (item.playModel && block.mode !== 'test' && !item.model) {
        controls.appendChild(el('button', { class: 'btn ghost', text: 'Klangmodell (korrekt)', onclick: () => { if (playing) playing.stop(); playing = item.playModel(); } }));
      }
      const moreBtn = el('button', { class: 'btn ghost', text: 'Mehr dazu', onclick: () => showCard(item.knowledge) });
      if (getCard(item.knowledge)) controls.appendChild(moreBtn);
      body.appendChild(controls);
      const answerBox = el('div', { class: 'answer-box' });
      body.appendChild(answerBox);
      let answered = false;
      item.renderAnswer(answerBox, (answer) => {
        if (answered) return;
        answered = true;
        if (playing) playing.stop();
        const ms = playedAt ? performance.now() - playedAt : null;
        let res;
        try { res = item.evaluate(answer); } catch (e) { console.error(e); res = { score: 0, correct: false, truthLabel: '?', answerLabel: '?' }; }
        recordAnswer({ skill: skill.id, stage: stageIdx, diff: item.diff, score: res.score, truth: res.truthKey, answer: res.answerKey, ms, weight: block.mode === 'test' ? 2 : 1, meta: { title: item.title } });
        results.answers++;
        results.score += res.score;
        results.perSkill[skill.id] = results.perSkill[skill.id] || { n: 0, score: 0 };
        results.perSkill[skill.id].n++;
        results.perSkill[skill.id].score += res.score;
        if (onProgress) onProgress(i + 1, block.items);
        renderFeedback(skill, item, res, answerBox);
      });
      setTimeout(doPlay, 350);
    };

    const renderFeedback = (skill, item, res, answerBox) => {
      answerBox.querySelectorAll('button').forEach((b) => b.setAttribute('disabled', 'disabled'));
      const fb = el('div', { class: 'feedback ' + (res.correct ? 'ok' : res.score > 0 ? 'partial' : 'bad') });
      fb.appendChild(el('div', { class: 'fb-head', text: res.correct ? 'Richtig' : res.score > 0 ? `Teilweise richtig (${Math.round(res.score * 100)} %)` : 'Falsch' }));
      fb.appendChild(el('div', { class: 'fb-line' }, [el('b', { text: 'Lösung: ' }), res.truthLabel]));
      fb.appendChild(el('div', { class: 'fb-line' }, [el('b', { text: 'Deine Antwort: ' }), res.answerLabel]));
      if (res.detail) fb.appendChild(el('div', { class: 'fb-line muted', text: res.detail }));
      if (res.renderFeedbackScore) {
        const sb = el('div');
        fb.appendChild(sb);
        try { res.renderFeedbackScore(sb); } catch (e) { console.error(e); }
      }
      const row = el('div', { class: 'fb-controls' });
      let cur = null;
      const stopCur = () => { if (cur) cur.stop(); stopAll(); };
      if (res.playTruth && block.mode !== 'test') row.appendChild(el('button', { class: 'btn ghost', text: '▶ ' + (res.truthPlayLabel || 'Richtig hören'), onclick: () => { stopCur(); cur = res.playTruth(); } }));
      if (res.playAnswer && !res.correct && block.mode !== 'test') row.appendChild(el('button', { class: 'btn ghost', text: '▶ ' + (res.answerPlayLabel || 'Deine Antwort hören'), onclick: () => { stopCur(); cur = res.playAnswer(); } }));
      if (res.playTruth && res.playAnswer && !res.correct && block.mode !== 'test') row.appendChild(el('button', { class: 'btn ghost', text: '▶ Im Wechsel', onclick: async () => { stopCur(); cur = res.playTruth(); await cur.done; cur = res.playAnswer(); } }));
      if (getCard(item.knowledge)) row.appendChild(el('button', { class: 'btn ghost', text: 'Mehr dazu', onclick: () => showCard(item.knowledge) }));
      const next = el('button', { class: 'btn primary', text: block.free || i + 1 < block.items ? 'Weiter' : 'Block abschließen', onclick: () => { stopCur(); i++; nextItem(); } });
      row.appendChild(next);
      fb.appendChild(row);
      answerBox.appendChild(fb);
      next.focus();
      fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    container._stop = () => { stopped = true; finish(); };
    nextItem();
  });
}

/** Ergebnisanzeige eines Blocks */
export function blockSummary(container, block, result) {
  const box = el('div', { class: 'summary' });
  const acc = result.answers ? Math.round((result.score / result.answers) * 100) : 0;
  box.appendChild(el('h3', { text: `${block.label || 'Block'} abgeschlossen` }));
  box.appendChild(el('p', { text: `${result.answers} Items · ${acc} % Trefferquote` }));
  for (const [id, d] of Object.entries(result.deltas || {})) {
    const s = skillStats(id);
    const sk = SKILL_BY_ID[id];
    box.appendChild(el('p', { class: 'small', text: `${sk.name}: Rating ${s.rating.toFixed(1)} (${d >= 0 ? '+' : ''}${d.toFixed(1)}), ${stageLabel(sk, currentStageIndex(id, sk.stages))}` }));
  }
  container.appendChild(box);
  return box;
}

export { runPassive, stageLabel };
