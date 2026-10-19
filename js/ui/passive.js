// Passives Hören: Choralphrasen in korrekter Fassung mit Partitur, ohne Antwort.
import { el, preload, play } from '../modules/common.js';
import { randomChorale, randomPhraseSpan, excerpt } from '../data/chorales.js';
import { renderExcerpt } from '../notation/score.js';
import { choraleEvents } from '../modules/errors.js';
import { assignParts, ensembleName } from '../audio/ensembles.js';
import { pick } from '../theory/pitch.js';
import { stopAll } from '../audio/sampler.js';
import { state } from '../engine/state.js';

const ENS = ['choir', 'organ', 'strings', 'woodwinds', 'brass', 'mixed'];

/**
 * block: { phrases: Anzahl Phrasen insgesamt, minutes }
 */
export function runPassive(container, block) {
  return new Promise(async (resolve) => {
    container.innerHTML = '';
    const header = el('div', { class: 'run-header' }, [el('div', { class: 'run-title' }, [el('span', { class: 'run-skill', text: 'Passives Hören' })]), el('div', { class: 'muted small', text: 'Nur hören. Die korrekte Fassung prägt das Klangmodell für das Fehlerhören.' })]);
    const body = el('div', { class: 'run-body' });
    container.appendChild(header);
    container.appendChild(body);
    let done = 0;
    let stopped = false;
    container._stop = () => { stopped = true; stopAll(); resolve({ answers: 0, score: 0, deltas: {}, stopped: true }); };
    const total = block.phrases || 4;
    while (done < total && !stopped) {
      const nPh = Math.min(2, total - done);
      const chorale = await randomChorale((c) => c.nPhrases >= nPh);
      const span = randomPhraseSpan(chorale, nPh);
      const ex = excerpt(chorale, span.start, span.end);
      const ens = pick(ENS);
      const events = choraleEvents(ex, ex.parts, ens, { bpm: state.settings.bpmChorale || 66 });
      body.innerHTML = '';
      body.appendChild(el('h2', { text: `${chorale.title}` }));
      body.appendChild(el('div', { class: 'hint', text: `BWV ${chorale.bwv} · Riemenschneider ${chorale.riemenschneider} · ${ensembleName(ens)} · ${ex.key.label} · Phrase ${span.phraseIndex + 1}${nPh > 1 ? '–' + (span.phraseIndex + nPh) : ''} von ${chorale.phrases.length}` }));
      const box = el('div', { class: 'score-box' });
      body.appendChild(box);
      try { renderExcerpt(box, ex, { maxWidth: Math.min(body.clientWidth || 900, 1100) }); } catch (e) { console.error(e); }
      const row = el('div', { class: 'controls' });
      let handle = null;
      const again = el('button', { class: 'btn', text: '▶ Nochmal', onclick: () => { if (handle) handle.stop(); handle = play(events); } });
      const next = el('button', { class: 'btn primary', text: done + nPh >= total ? 'Block abschließen' : 'Weiter' });
      row.appendChild(again);
      row.appendChild(next);
      body.appendChild(row);
      await preload(events);
      if (stopped) break;
      handle = play(events);
      await new Promise((res) => { next.addEventListener('click', () => { if (handle) handle.stop(); res(); }); });
      done += nPh;
    }
    if (!stopped) resolve({ answers: 0, score: 0, deltas: {}, stopped: false, passive: true });
  });
}
