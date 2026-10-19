// Persistenz: ein Zustandsobjekt in IndexedDB, mit Export/Import als JSON.
const DB_NAME = 'world-class-ear';
const STORE = 'kv';
const KEY = 'state';

export const state = {
  version: 1,
  createdAt: Date.now(),
  skills: {},
  confusion: {},
  answers: [],
  lessons: [],
  settings: { defaultMinutes: 45, volume: 0.7, showEnglish: true, bpmChorale: 66 },
  streak: { current: 0, lastDate: null },
};

let db = null;
let saveTimer = null;
const listeners = new Set();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState() {
  try {
    db = await openDb();
    const saved = await idbGet(KEY);
    if (saved) mergeInto(state, saved);
  } catch (e) {
    console.warn('IndexedDB nicht verfügbar, versuche localStorage', e);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) mergeInto(state, JSON.parse(raw));
    } catch (e2) {}
  }
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) {}
  return state;
}

function mergeInto(target, src) {
  for (const k of Object.keys(src)) {
    if (k === 'settings') Object.assign(target.settings, src.settings || {});
    else target[k] = src[k];
  }
}

export function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const snapshot = JSON.parse(JSON.stringify(state));
    try {
      if (db) await idbSet(KEY, snapshot);
      else localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('Speichern fehlgeschlagen', e);
    }
    for (const fn of listeners) fn(state);
  }, 300);
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function exportJson() {
  return JSON.stringify(state, null, 1);
}

export async function importJson(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object' || !obj.skills) throw new Error('Keine gültige World-Class-Ear-Datei');
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, obj);
  saveState();
}

export function todayKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
