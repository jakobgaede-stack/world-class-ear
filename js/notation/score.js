// Notendarstellung mit VexFlow 5: Choralausschnitt (1 bis 4 Stimmen) mit Anklick-Erkennung der Noten.
import { spellingToVex, fifthsToVexKey } from '../theory/pitch.js';

const VF = () => window.VexFlow;

const DUR_MAP = [
  [4, 'w'], [3, 'hd'], [2, 'h'], [1.5, 'qd'], [1, 'q'], [0.75, '8d'], [0.5, '8'], [0.375, '16d'], [0.25, '16'], [0.125, '32'],
];

/** Dauer in Vierteln -> Liste von VexFlow-Dauern (mit Bindung, wenn zusammengesetzt) */
function splitDuration(q) {
  const out = [];
  let rest = q;
  let guard = 0;
  while (rest > 1e-6 && guard++ < 8) {
    const hit = DUR_MAP.find(([v]) => v <= rest + 1e-6);
    if (!hit) break;
    out.push(hit[1]);
    rest -= hit[0];
  }
  return out.length ? out : ['q'];
}

const STAFF_GAP = 92;
const TOP = 28;
const LEFT = 12;

/**
 * Zeichnet einen Ausschnitt.
 * @param container Element (wird geleert)
 * @param ex excerpt() aus data/chorales.js
 * @param opts { parts: Indizes der zu zeichnenden Stimmen, marks: [{part, idx, color}], onPick(part, noteIdx, note), maxWidth }
 * @returns { noteBoxes, svg, scale }
 */
export function renderExcerpt(container, ex, opts = {}) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, StaveTie, StaveConnector, Beam, Dot, Modifier } = VF();
  container.innerHTML = '';
  const partIdxs = opts.parts || ex.parts.map((_, i) => i);
  const nParts = partIdxs.length;
  const [tsNum, tsDen] = ex.timeSig.split('/').map(Number);
  const keySpec = fifthsToVexKey(ex.chorale.keySig || 0);
  // Durchgang 1: Stimmen je Takt aufbauen und Mindestbreite bestimmen
  const noteBoxes = [];
  const marks = opts.marks || [];
  const tieQueue = []; // {firstNote, lastNote}
  const pendingTie = {}; // part -> StaveNote, die eine Bindung beginnt
  const built = ex.measures.map((m, mi) => {
    const voices = [];
    const beamsAll = [];
    partIdxs.forEach((pi) => {
      const part = ex.parts[pi];
      const isTenor = part.name === 'T';
      const clefName = part.name === 'B' || (part.clef === 'bass' && part.name !== 'T') ? 'bass' : 'treble';
      const notes = part.notes.filter((n) => n.o >= m.offset - 1e-6 && n.o < m.end - 1e-6);
      const tickables = [];
      let cursor = m.offset;
      const octShift = isTenor && clefName === 'treble' ? 1 : 0;
      const pushRest = (q) => {
        for (const d of splitDuration(q)) {
          const r = new StaveNote({ keys: [clefName === 'bass' ? 'd/3' : 'b/4'], duration: d.replace('d', '') + 'r', clef: clefName });
          if (d.endsWith('d')) Dot.buildAndAttach([r], { all: true });
          tickables.push(r);
        }
      };
      for (const n of notes) {
        if (n.o > cursor + 1e-6) pushRest(n.o - cursor);
        const durs = splitDuration(Math.min(n.d, m.end - n.o));
        const key = spellingToVex(n.spelling, octShift);
        let prev = null;
        durs.forEach((d, di) => {
          const sn = new StaveNote({ keys: [key], duration: d.replace('d', ''), clef: clefName });
          if (d.endsWith('d')) Dot.buildAndAttach([sn], { all: true });
          if (n.fermata && di === durs.length - 1) sn.addModifier(new Articulation('a@a').setPosition(Modifier.Position.ABOVE), 0);
          const mark = marks.find((mk) => mk.part === pi && mk.idx === n.idx);
          if (mark) sn.setStyle({ fillStyle: mark.color, strokeStyle: mark.color });
          sn._wce = { part: pi, idx: n.idx, note: n };
          tickables.push(sn);
          if (prev) tieQueue.push({ firstNote: prev, lastNote: sn });
          prev = sn;
        });
        if (pendingTie[pi]) {
          tieQueue.push({ firstNote: pendingTie[pi], lastNote: tickables[tickables.length - durs.length] });
          pendingTie[pi] = null;
        }
        if (n.tie === 'start' || n.tie === 'continue' || n.clippedEnd) pendingTie[pi] = prev;
        cursor = n.o + Math.min(n.d, m.end - n.o);
      }
      if (cursor < m.end - 1e-6) pushRest(m.end - cursor);
      const voice = new Voice({ numBeats: tsNum, beatValue: tsDen }).setMode(Voice.Mode.SOFT);
      voice.addTickables(tickables);
      Accidental.applyAccidentals([voice], keySpec);
      voices.push({ voice, clefName, isTenor, pi });
      beamsAll.push(...Beam.generateBeams(tickables.filter((t) => !t.isRest()), { maintainStemDirections: false }));
    });
    const fmt = new Formatter();
    for (const v of voices) fmt.joinVoices([v.voice]);
    const minW = fmt.preCalculateMinTotalWidth(voices.map((v) => v.voice));
    const quarters = m.end - m.offset;
    const noteWidth = Math.max(minW * 1.3, quarters * 38, 60);
    return { m, mi, voices, beamsAll, fmt, noteWidth };
  });
  // Breite der Vorzeichnung (Schlüssel, Tonart, Taktart) des ersten Takts messen
  const probe = new Stave(0, 0, 400);
  probe.addClef('treble').addKeySignature(keySpec).addTimeSignature(ex.timeSig);
  const modW = probe.getNoteStartX() - probe.getX();
  const measureInfo = built.map((b) => ({ ...b.m, width: Math.round(b.noteWidth + 22 + (b.mi === 0 ? modW + 12 : 14)) }));
  const totalWidth = LEFT + measureInfo.reduce((s, m) => s + m.width, 0) + 16;
  const height = TOP + STAFF_GAP * nParts + 20;
  const maxWidth = opts.maxWidth || container.clientWidth || 900;
  const scale = Math.min(1, Math.max(0.55, maxWidth / totalWidth));
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(Math.ceil(totalWidth * scale), Math.ceil(height * scale));
  const ctx = renderer.getContext();
  ctx.scale(scale, scale);
  const allStaves = [];
  let x = LEFT;
  // Durchgang 2: Systeme zeichnen, Stimmen formatieren
  built.forEach((b, mi) => {
    const m = measureInfo[mi];
    const staves = [];
    b.voices.forEach((v, row) => {
      const y = TOP + row * STAFF_GAP;
      const stave = new Stave(x, y, m.width);
      if (mi === 0) {
        if (v.isTenor && v.clefName === 'treble') stave.addClef('treble', 'default', '8vb');
        else stave.addClef(v.clefName);
        stave.addKeySignature(keySpec);
        stave.addTimeSignature(ex.timeSig);
      }
      stave.setContext(ctx).draw();
      staves.push(stave);
      v.stave = stave;
    });
    const s0 = staves[0];
    const justify = Math.max(40, s0.getNoteEndX() - s0.getNoteStartX() - 24);
    b.fmt.format(b.voices.map((v) => v.voice), justify);
    for (const v of b.voices) v.voice.draw(ctx, v.stave);
    for (const bm of b.beamsAll) bm.setContext(ctx).draw();
    if (nParts > 1) {
      new StaveConnector(staves[0], staves[nParts - 1]).setType(mi === 0 ? StaveConnector.type.BRACKET : StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
      if (mi === 0) new StaveConnector(staves[0], staves[nParts - 1]).setType(StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
    }
    allStaves.push(staves);
    for (const v of b.voices) {
      for (const t of v.voice.getTickables()) {
        if (!t._wce) continue;
        const bb = t.getBoundingBox();
        if (!bb) continue;
        noteBoxes.push({ part: t._wce.part, idx: t._wce.idx, note: t._wce.note, x: bb.getX ? bb.getX() : bb.x, y: bb.getY ? bb.getY() : bb.y, w: bb.getW ? bb.getW() : bb.w, h: bb.getH ? bb.getH() : bb.h });
      }
    }
    x += m.width;
  });
  // Schlussstrich rechts
  if (nParts > 1 && allStaves.length) {
    const last = allStaves[allStaves.length - 1];
    new StaveConnector(last[0], last[nParts - 1]).setType(StaveConnector.type.SINGLE_RIGHT).setContext(ctx).draw();
  }
  for (const t of tieQueue) {
    try {
      new StaveTie({ firstNote: t.firstNote, lastNote: t.lastNote, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
    } catch (e) { /* Bindung über Zeilen hinweg ignorieren */ }
  }
  const svg = container.querySelector('svg');
  if (svg) svg.style.display = 'block';
  // Klick -> nächste Note
  if (opts.onPick && svg) {
    svg.style.cursor = 'pointer';
    svg.addEventListener('pointerdown', (e) => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) / scale;
      const py = (e.clientY - r.top) / scale;
      let best = null;
      let bestD = Infinity;
      for (const nb of noteBoxes) {
        const cx = nb.x + nb.w / 2;
        const cy = nb.y + nb.h / 2;
        const d = Math.hypot((px - cx) * 1.2, py - cy);
        if (d < bestD) { bestD = d; best = nb; }
      }
      if (best && bestD < 48) opts.onPick(best.part, best.idx, best.note, best);
    });
  }
  return { noteBoxes, svg, scale, totalWidth, height, highlight(nb, color = 'rgba(80,140,255,0.35)') {
    if (!svg) return;
    svg.querySelectorAll('.wce-hl').forEach((h) => h.remove());
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'wce-hl');
    rect.setAttribute('x', (nb.x - 6) * scale);
    rect.setAttribute('y', (nb.y - 6) * scale);
    rect.setAttribute('width', (nb.w + 12) * scale);
    rect.setAttribute('height', (nb.h + 12) * scale);
    rect.setAttribute('rx', 6 * scale);
    rect.setAttribute('fill', color);
    svg.appendChild(rect);
  } };
}
