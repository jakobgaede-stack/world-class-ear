// Akkordtypen, Benennungen und Voicings.
import { pc, pcName, pcNameEn, clamp, pick, randInt, shuffle } from './pitch.js';

// iv: Halbtöne vom Grundton; mem: Bezeichnung der Akkordtöne; sym: Jazz-Symbol (englisch, ohne Grundton)
export const CHORD_TYPES = [
  // Dreiklänge
  { id: 'maj', cat: 'triads', de: 'Dur', sym: '', iv: [0, 4, 7], mem: ['Grundton', 'Terz', 'Quinte'] },
  { id: 'min', cat: 'triads', de: 'Moll', sym: 'm', iv: [0, 3, 7], mem: ['Grundton', 'Terz', 'Quinte'] },
  { id: 'dim', cat: 'triads', de: 'vermindert', sym: '°', iv: [0, 3, 6], mem: ['Grundton', 'Terz', 'Quinte'] },
  { id: 'aug', cat: 'triads', de: 'übermäßig', sym: '+', iv: [0, 4, 8], mem: ['Grundton', 'Terz', 'Quinte'] },
  { id: 'sus2', cat: 'triads', de: 'sus2', sym: 'sus2', iv: [0, 2, 7], mem: ['Grundton', 'Sekunde', 'Quinte'], tier: 2 },
  { id: 'sus4', cat: 'triads', de: 'sus4', sym: 'sus4', iv: [0, 5, 7], mem: ['Grundton', 'Quarte', 'Quinte'], tier: 2 },
  // Septakkorde (Persichetti Ex. 3-17, dunkel nach hell)
  { id: 'dim7', cat: 'sevenths', de: 'verminderter Septakkord', sym: '°7', iv: [0, 3, 6, 9], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'] },
  { id: 'm7b5', cat: 'sevenths', de: 'halbverminderter Septakkord', sym: 'ø7', iv: [0, 3, 6, 10], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'] },
  { id: 'm7', cat: 'sevenths', de: 'Moll-Septakkord', sym: 'm7', iv: [0, 3, 7, 10], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'] },
  { id: 'mMaj7', cat: 'sevenths', de: 'Moll-Dur-Septakkord', sym: 'mMaj7', iv: [0, 3, 7, 11], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'] },
  { id: 'dom7', cat: 'sevenths', de: 'Dominantseptakkord', sym: '7', iv: [0, 4, 7, 10], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'] },
  { id: 'maj7', cat: 'sevenths', de: 'Dur-Septakkord (große Septime)', sym: 'maj7', iv: [0, 4, 7, 11], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'] },
  { id: 'augMaj7', cat: 'sevenths', de: 'übermäßiger Dur-Septakkord', sym: '+maj7', iv: [0, 4, 8, 11], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'] },
  { id: 'aug7', cat: 'sevenths', de: 'übermäßiger Septakkord', sym: '7#5', iv: [0, 4, 8, 10], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'], tier: 2 },
  { id: '7b5', cat: 'sevenths', de: 'Septakkord mit verminderter Quinte', sym: '7b5', iv: [0, 4, 6, 10], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'], tier: 2 },
  { id: 'maj7b5', cat: 'sevenths', de: 'Dur-Septakkord mit verminderter Quinte', sym: 'maj7b5', iv: [0, 4, 6, 11], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'], tier: 2 },
  { id: '7sus4', cat: 'sevenths', de: 'Septakkord mit Quartvorhalt', sym: '7sus4', iv: [0, 5, 7, 10], mem: ['Grundton', 'Quarte', 'Quinte', 'Septime'], tier: 2 },
  { id: 'dimMaj7', cat: 'sevenths', de: 'verminderter Dreiklang mit großer Septime', sym: '°maj7', iv: [0, 3, 6, 11], mem: ['Grundton', 'Terz', 'Quinte', 'Septime'], tier: 2 },
  { id: '6', cat: 'sevenths', de: 'Dur-Sextakkord (Dur mit Sexte)', sym: '6', iv: [0, 4, 7, 9], mem: ['Grundton', 'Terz', 'Quinte', 'Sexte'], tier: 2 },
  { id: 'm6', cat: 'sevenths', de: 'Moll-Sextakkord', sym: 'm6', iv: [0, 3, 7, 9], mem: ['Grundton', 'Terz', 'Quinte', 'Sexte'], tier: 2 },
  // Erweiterungen
  { id: 'dom9', cat: 'extensions', de: 'Dominant-Nonakkord', sym: '9', iv: [0, 4, 7, 10, 14], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None'] },
  { id: 'maj9', cat: 'extensions', de: 'Dur-Nonakkord (große Septime)', sym: 'maj9', iv: [0, 4, 7, 11, 14], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None'] },
  { id: 'm9', cat: 'extensions', de: 'Moll-Nonakkord', sym: 'm9', iv: [0, 3, 7, 10, 14], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None'] },
  { id: '7b9', cat: 'extensions', de: 'Dominantsept mit kleiner None', sym: '7b9', iv: [0, 4, 7, 10, 13], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None'] },
  { id: '7#9', cat: 'extensions', de: 'Dominantsept mit übermäßiger None', sym: '7#9', iv: [0, 4, 7, 10, 15], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None'] },
  { id: 'mMaj9', cat: 'extensions', de: 'Moll-Dur-Nonakkord', sym: 'mMaj9', iv: [0, 3, 7, 11, 14], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None'], tier: 2 },
  { id: '69', cat: 'extensions', de: 'Dur mit Sexte und None', sym: '6/9', iv: [0, 4, 7, 9, 14], mem: ['Grundton', 'Terz', 'Quinte', 'Sexte', 'None'], tier: 2 },
  { id: 'm69', cat: 'extensions', de: 'Moll mit Sexte und None', sym: 'm6/9', iv: [0, 3, 7, 9, 14], mem: ['Grundton', 'Terz', 'Quinte', 'Sexte', 'None'], tier: 2 },
  { id: 'dom11', cat: 'extensions', de: 'Dominant-Undezimakkord (ohne Terz)', sym: '11', iv: [0, 7, 10, 14, 17], mem: ['Grundton', 'Quinte', 'Septime', 'None', 'Undezime'], tier: 3 },
  { id: 'm11', cat: 'extensions', de: 'Moll-Undezimakkord', sym: 'm11', iv: [0, 3, 7, 10, 14, 17], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None', 'Undezime'], tier: 3 },
  { id: '7#11', cat: 'extensions', de: 'Dominantsept mit übermäßiger Undezime', sym: '7#11', iv: [0, 4, 7, 10, 18], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'Undezime'], tier: 3 },
  { id: 'maj7#11', cat: 'extensions', de: 'Dur-Septakkord mit übermäßiger Undezime (lydisch)', sym: 'maj7#11', iv: [0, 4, 7, 11, 18], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'Undezime'], tier: 3 },
  { id: 'dom13', cat: 'extensions', de: 'Dominant-Tredezimakkord', sym: '13', iv: [0, 4, 7, 10, 14, 21], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None', 'Tredezime'], tier: 4 },
  { id: 'maj13', cat: 'extensions', de: 'Dur-Tredezimakkord', sym: 'maj13', iv: [0, 4, 7, 11, 14, 21], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None', 'Tredezime'], tier: 4 },
  { id: 'm13', cat: 'extensions', de: 'Moll-Tredezimakkord', sym: 'm13', iv: [0, 3, 7, 10, 14, 21], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'None', 'Tredezime'], tier: 4 },
  { id: '7b13', cat: 'extensions', de: 'Dominantsept mit kleiner Tredezime', sym: '7b13', iv: [0, 4, 7, 10, 20], mem: ['Grundton', 'Terz', 'Quinte', 'Septime', 'Tredezime'], tier: 4 },
  { id: '7alt', cat: 'extensions', de: 'alterierte Dominante (b9, #9, b13)', sym: '7alt', iv: [0, 4, 10, 13, 15, 20], mem: ['Grundton', 'Terz', 'Septime', 'None', 'None', 'Tredezime'], tier: 4 },
  // Quart- und Quintklänge (Persichetti Kap. 4)
  { id: 'q3pp', cat: 'quartal', de: 'Quartklang rein-rein (3 Töne)', sym: 'Quarten (r-r)', iv: [0, 5, 10], mem: ['tiefster Ton', 'mittlerer Ton', 'oberster Ton'] },
  { id: 'q3pa', cat: 'quartal', de: 'Quartklang rein-übermäßig (3 Töne)', sym: 'Quarten (r-üb)', iv: [0, 5, 11], mem: ['tiefster Ton', 'mittlerer Ton', 'oberster Ton'] },
  { id: 'q3ap', cat: 'quartal', de: 'Quartklang übermäßig-rein (3 Töne)', sym: 'Quarten (üb-r)', iv: [0, 6, 11], mem: ['tiefster Ton', 'mittlerer Ton', 'oberster Ton'] },
  { id: 'q4', cat: 'quartal', de: 'Quartklang (4 Töne, rein)', sym: 'Quarten (4)', iv: [0, 5, 10, 15], mem: ['1', '2', '3', '4'], tier: 2 },
  { id: 'q4a', cat: 'quartal', de: 'Quartklang (4 Töne, mit Tritonus)', sym: 'Quarten (4, üb)', iv: [0, 5, 10, 16], mem: ['1', '2', '3', '4'], tier: 2 },
  { id: 'q5', cat: 'quartal', de: 'Quartklang (5 Töne)', sym: 'Quarten (5)', iv: [0, 5, 10, 15, 20], mem: ['1', '2', '3', '4', '5'], tier: 3 },
  { id: 'sowhat', cat: 'quartal', de: '„So What“-Voicing (Quarten plus große Terz)', sym: 'So What', iv: [0, 5, 10, 15, 19], mem: ['1', '2', '3', '4', '5'], tier: 3 },
  { id: 'f3', cat: 'quartal', de: 'Quintklang (3 Töne)', sym: 'Quinten (3)', iv: [0, 7, 14], mem: ['1', '2', '3'], tier: 2 },
  { id: 'f4', cat: 'quartal', de: 'Quintklang (4 Töne)', sym: 'Quinten (4)', iv: [0, 7, 14, 21], mem: ['1', '2', '3', '4'], tier: 3 },
  { id: 'mix34', cat: 'quartal', de: 'Mischklang Terz-Quarte', sym: 'Terz+Quarte', iv: [0, 4, 9], mem: ['1', '2', '3'], tier: 3 },
  { id: 'mix43', cat: 'quartal', de: 'Mischklang Quarte-Terz', sym: 'Quarte+Terz', iv: [0, 5, 9], mem: ['1', '2', '3'], tier: 3 },
  // Sekundklänge (Persichetti Kap. 6)
  { id: 's3MM', cat: 'secundal', de: 'Sekundklang groß-groß', sym: 'Sekunden (g-g)', iv: [0, 2, 4], mem: ['1', '2', '3'] },
  { id: 's3Mm', cat: 'secundal', de: 'Sekundklang groß-klein', sym: 'Sekunden (g-k)', iv: [0, 2, 3], mem: ['1', '2', '3'] },
  { id: 's3mM', cat: 'secundal', de: 'Sekundklang klein-groß', sym: 'Sekunden (k-g)', iv: [0, 1, 3], mem: ['1', '2', '3'] },
  { id: 's3mm', cat: 'secundal', de: 'Sekundklang klein-klein', sym: 'Sekunden (k-k)', iv: [0, 1, 2], mem: ['1', '2', '3'] },
];

export const CHORD_BY_ID = Object.fromEntries(CHORD_TYPES.map((c) => [c.id, c]));

export const CATEGORY_DE = {
  triads: 'Dreiklänge',
  sevenths: 'Septakkorde',
  extensions: 'Erweiterungen',
  quartal: 'Quart- und Quintklänge',
  secundal: 'Sekundklänge',
  poly: 'Polyakkorde',
  setclass: 'Setklassen',
  cluster: 'Cluster',
};

export const INVERSION_DE = ['Grundstellung', '1. Umkehrung', '2. Umkehrung', '3. Umkehrung', '4. Umkehrung', '5. Umkehrung'];

/** Symbol mit Grundton, z. B. 'F#m7' oder 'Bbmaj7'. */
export function chordSymbol(type, rootPc, { flats = false } = {}) {
  return pcNameEn(rootPc, { flats }) + type.sym;
}

/** Deutscher Name mit Grundton, z. B. 'Fis-Moll-Septakkord'. */
export function chordNameDe(type, rootPc, { flats = false } = {}) {
  if (['quartal', 'secundal'].includes(type.cat)) return type.de + ' auf ' + pcName(rootPc, { flats });
  return pcName(rootPc, { flats }) + ' ' + type.de;
}

/**
 * Voicing erzeugen.
 * opts: inversion (Index des Akkordtons im Bass), spacing 'close'|'drop2'|'open'|'wide',
 *       bassTarget (MIDI, ungefähre Lage des tiefsten Tons), nVoices (Verdopplungen), lo/hi (Ambitus)
 * Rückgabe: { midis (aufsteigend), members (Akkordton je MIDI), bassMember }
 */
export function voiceChord(type, rootPc, opts = {}) {
  const inversion = opts.inversion || 0;
  const spacing = opts.spacing || 'close';
  const bassTarget = opts.bassTarget ?? 48;
  const lo = opts.lo ?? 24;
  const hi = opts.hi ?? 96;
  const n = type.iv.length;
  const inv = clamp(inversion, 0, n - 1);
  // Reihenfolge der Akkordtöne ab dem Basston
  const order = [];
  for (let k = 0; k < n; k++) order.push((inv + k) % n);
  // enge Lage: jeden folgenden Ton knapp über dem vorigen
  const pcs = order.map((i) => pc(rootPc + type.iv[i]));
  let bass = bassTarget + ((pcs[0] - pc(bassTarget) + 12) % 12);
  if (bass - bassTarget > 6) bass -= 12;
  let midis = [bass];
  for (let k = 1; k < n; k++) {
    const prev = midis[k - 1];
    let m = prev + ((pcs[k] - pc(prev) + 12) % 12);
    if (m === prev) m += 12;
    midis.push(m);
  }
  let members = order.map((i) => type.mem[i]);
  if (spacing === 'drop2' && n >= 4) {
    // zweithöchster Ton eine Oktave tiefer
    const idx = n - 2;
    midis[idx] -= 12;
  } else if (spacing === 'open') {
    // jeden zweiten Ton (ab dem zweiten) eine Oktave höher
    for (let k = 1; k < n; k += 2) midis[k] += 12;
  } else if (spacing === 'wide') {
    // Abstände 7 bis 12 Halbtöne, Basston bleibt
    for (let k = 1; k < n; k++) {
      const prev = midis[k - 1];
      let m = prev + ((pcs[k] - pc(prev) + 12) % 12);
      while (m - prev < 7) m += 12;
      midis[k] = m;
    }
  }
  // Verdopplungen
  const nVoices = opts.nVoices || n;
  const extraMembers = [];
  if (nVoices > n) {
    const candidates = ['Grundton', 'Quinte', 'Terz'].filter((x) => type.mem.includes(x));
    let add = nVoices - n;
    let ci = 0;
    while (add > 0) {
      const memName = candidates.length ? candidates[ci % candidates.length] : type.mem[ci % n];
      const idx = type.mem.indexOf(memName);
      const target = pc(rootPc + type.iv[idx]);
      // Verdopplung oberhalb des höchsten Tons
      const top = Math.max(...midis);
      let m = top + ((target - pc(top) + 12) % 12);
      if (m === top) m += 12;
      midis.push(m);
      extraMembers.push(memName);
      add--;
      ci++;
    }
  }
  // sortieren, Members mitführen
  const pairs = midis.map((m, i) => ({ m, mem: i < members.length ? members[i] : extraMembers[i - members.length] }));
  pairs.sort((a, b) => a.m - b.m);
  // Ambitus: ganzes Voicing verschieben
  let shift = 0;
  if (pairs[0].m < lo) shift = 12 * Math.ceil((lo - pairs[0].m) / 12);
  if (pairs[pairs.length - 1].m + shift > hi) shift -= 12 * Math.ceil((pairs[pairs.length - 1].m + shift - hi) / 12);
  return {
    midis: pairs.map((p) => p.m + shift),
    members: pairs.map((p) => p.mem),
    bassMember: pairs[0].mem,
    inversion: inv,
    spacing,
  };
}

/** Polyakkord: zwei Dreiklänge; unten lower, oben upper (Abstand in Halbtönen zwischen den Grundtönen). */
export function voicePolychord(lowerType, lowerRoot, upperType, upperRoot, { bassTarget = 43 } = {}) {
  const lower = voiceChord(lowerType, lowerRoot, { bassTarget, spacing: 'close' });
  const upper = voiceChord(upperType, upperRoot, { bassTarget: Math.max(...lower.midis) + 3, spacing: 'close' });
  return {
    midis: [...lower.midis, ...upper.midis],
    members: [...lower.members.map((m) => 'unten ' + m), ...upper.members.map((m) => 'oben ' + m)],
    lower,
    upper,
  };
}

/** Cluster: n Töne ab start, diatonisch (Leiter-Pcs) oder chromatisch. */
export function makeCluster(start, n, { diatonic = null } = {}) {
  const midis = [start];
  let m = start;
  while (midis.length < n) {
    m += 1;
    if (!diatonic || diatonic.has(pc(m))) midis.push(m);
  }
  return midis;
}

/** Diatonische Tonklassen einer Dur-Tonart */
export function majorScalePcs(tonic) {
  return new Set([0, 2, 4, 5, 7, 9, 11].map((s) => pc(tonic + s)));
}

/** Zufälliger Grundton */
export function randomRoot() {
  return randInt(0, 11);
}

/** Typen einer Kategorie bis zur angegebenen Stufe (tier) */
export function typesFor(cat, maxTier = 1) {
  return CHORD_TYPES.filter((t) => t.cat === cat && (t.tier || 1) <= maxTier);
}

export { pick, shuffle };
