// Einstieg: Zustand laden, Router, Audio freischalten.
import { loadState, state } from './engine/state.js';
import { loadManifest } from './audio/sampler.js';
import { unlockAudio, setMasterVolume } from './audio/context.js';
import { viewToday, viewPractice, viewStats, viewKnowledge, viewSettings } from './ui/views.js';
import { el } from './modules/common.js';
import { initSync } from './engine/sync.js';

const ROUTES = {
  heute: viewToday,
  ueben: viewPractice,
  statistik: viewStats,
  wissen: viewKnowledge,
  einstellungen: viewSettings,
};

function route() {
  const hash = (location.hash || '#heute').slice(1);
  const [name, arg] = hash.split('/');
  const fn = ROUTES[name] || viewToday;
  const app = document.getElementById('app');
  if (app._stop) { try { app._stop(); } catch (e) {} app._stop = null; }
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + name));
  fn(app, arg);
}

async function init() {
  await loadState();
  try { await initSync(); } catch (e) { console.warn('Sync', e); }
  try { await loadManifest(); } catch (e) { console.error('Manifest fehlt', e); }
  if (state.settings.volume !== undefined) {
    document.addEventListener('pointerdown', () => { try { setMasterVolume(state.settings.volume); } catch (e) {} }, { once: true });
  }
  document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
  document.addEventListener('keydown', () => unlockAudio(), { capture: true });
  window.addEventListener('hashchange', route);
  route();
  const sw = 'serviceWorker' in navigator;
  if (sw && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
