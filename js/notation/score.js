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

const TOP = 28;

/**
 * Zeichnet einen Ausschnitt.
 * @param container Element (wird geleert)
 * @param ex excerpt() aus data/chorales.js
 * @param opts { parts: Indizes der zu zeichnenden Stimmen, marks: [{part, idx, color}], onPick(part, noteIdx, note), maxWidth }
 * @returns { noteBoxes, svg, scale }
 */
export function renderExcerpt(container, ex, opts = {}) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, StaveTie, StaveConnector, Beam, Dot, Modifier, Annotation } = VF();
  container.innerHTML = '';
  const STAFF_GAP = opts.staffGap || 92;
  const LEFT = opts.partLabels ? 92 : 12;
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
      let clefName = part.name === 'B' || (part.clef === 'bass' && part.name !== 'T') ? 'bass' : 'treble';
      if (part.clef === 'alto' || part.clef === 'tenor') clefName = part.clef;
      const restKey = { treble: 'b/4', bass: 'd/3', alto: 'c/4', tenor: 'a/3' }[clefName];
      const notes = part.notes.filter((n) => n.o >= m.offset - 1e-6 && n.o < m.end - 1e-6);
      const tickables = [];
      let cursor = m.offset;
      const octShift = isTenor && clefName === 'treble' ? 1 : 0;
      const pushRest = (q) => {
        for (const d of splitDuration(q)) {
          const r = new StaveNote({ keys: [restKey], duration: d + 'r', clef: clefName });
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
          const sn = new StaveNote({ keys: [key], duration: d, clef: clefName });
          if (d.endsWith('d')) Dot.buildAndAttach([sn], { all: true });
          if (n.fermata && di === durs.length - 1) sn.addModifier(new Articulation('a@a').setPosition(Modifier.Position.ABOVE), 0);
          if (n.lyric && di === 0) sn.addModifier(new Annotation(n.lyric).setFont('Academico', 11).setVerticalJustification(Annotation.VerticalJustify.BOTTOM), 0);
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
  // Breite der Vorzeichnung (Schlüssel, Tonart, Taktart) messen
  const probe = new Stave(0, 0, 400);
  probe.addClef('treble').addKeySignature(keySpec).addTimeSignature(ex.timeSig);
  const modW = probe.getNoteStartX() - probe.getX();
  const probe2 = new Stave(0, 0, 400);
  probe2.addClef('treble').addKeySignature(keySpec);
  const modW2 = probe2.getNoteStartX() - probe2.getX();
  const maxWidth = opts.maxWidth || container.clientWidth || 900;
  // Takte auf Systeme verteilen: ein System, solange es bei Skalierung >= 0.72 passt; sonst umbrechen
  const widthOf = (b, first, withTime) => Math.round(b.noteWidth + 22 + (first ? (withTime ? modW : modW2) + 12 : 14));
  const systems = [];
  const minScaleOneLine = 0.72;
  const limit = maxWidth / minScaleOneLine - LEFT - 16;
  let row = [];
  let rowW = 0;
  built.forEach((b, mi) => {
    const w = widthOf(b, row.length === 0, mi === 0);
    if (row.length && rowW + w > limit) { systems.push(row); row = []; rowW = 0; }
    row.push(mi);
    rowW += widthOf(b, row.length === 1, mi === 0);
  });
  if (row.length) systems.push(row);
  // Ausgleich: Aufteilung in gleich viele Zeilen mit minimaler maximaler Zeilenbreite (dynamische Programmierung)
  if (systems.length > 1) {
    const n = systems.length;
    const m = built.length;
    const rowWidth = (a, bEnd) => { let w = 0; for (let i = a; i < bEnd; i++) w += widthOf(built[i], i === a, i === 0); return w; };
    // best[r][i]: minimale maximale Breite für die ersten i Takte in r Zeilen
    const INF = 1e12;
    const best = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
    const cut = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    best[0][0] = 0;
    for (let r = 1; r <= n; r++) {
      for (let i = r; i <= m; i++) {
        for (let j = r - 1; j < i; j++) {
          const w = Math.max(best[r - 1][j], rowWidth(j, i));
          if (w < best[r][i]) { best[r][i] = w; cut[r][i] = j; }
        }
      }
    }
    const rows = [];
    let i = m;
    for (let r = n; r >= 1; r--) { const j = cut[r][i]; rows.unshift(built.slice(j, i).map((_, k) => j + k)); i = j; }
    systems.length = 0;
    systems.push(...rows);
  }
  const SYSTEM_GAP = 36;
  const sysWidths = systems.map((sys) => LEFT + sys.reduce((acc, mi, k) => acc + widthOf(built[mi], k === 0, mi === 0), 0) + 16);
  const totalWidth = Math.max(...sysWidths);
  const sysHeight = STAFF_GAP * nParts;
  const height = TOP + systems.length * sysHeight + (systems.length - 1) * SYSTEM_GAP + 20;
  const scale = Math.min(1, Math.max(0.55, maxWidth / totalWidth));
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(Math.ceil(totalWidth * scale), Math.ceil(height * scale));
  const ctx = renderer.getContext();
  ctx.scale(scale, scale);
  const allStaves = [];
  // Durchgang 2: Systeme zeichnen, Stimmen formatieren
  systems.forEach((sys, si) => {
    let x = LEFT;
    const y0 = TOP + si * (sysHeight + SYSTEM_GAP);
    sys.forEach((mi, k) => {
      const b = built[mi];
      const first = k === 0;
      const width = widthOf(b, first, mi === 0);
      const staves = [];
      b.voices.forEach((v, rowI) => {
        const y = y0 + rowI * STAFF_GAP;
        const stave = new Stave(x, y, width);
        if (first) {
          if (v.isTenor && v.clefName === 'treble') stave.addClef('treble', 'default', '8vb');
          else stave.addClef(v.clefName);
          stave.addKeySignature(keySpec);
          if (mi === 0) stave.addTimeSignature(ex.timeSig);
          if (opts.partLabels) {
            const label = (ex.parts[v.pi].abbr || ex.parts[v.pi].name || '').slice(0, 12);
            try { stave.setStaveText(label, Modifier.Position.LEFT, { shiftX: 10, shiftY: 0 }); } catch (e) { console.warn('Stimmenbezeichnung', e); }
          }
        }
        if (k === sys.length - 1 && si === systems.length - 1 && nParts === 1) stave.setEndBarType(3);
        stave.setContext(ctx).draw();
        staves.push(stave);
        v.stave = stave;
      });
      const s0 = staves[0];
      const justify = Math.max(40, s0.getNoteEndX() - s0.getNoteStartX() - (first ? 14 : 24));
      b.fmt.format(b.voices.map((v) => v.voice), justify);
      for (const v of b.voices) v.voice.draw(ctx, v.stave);
      for (const bm of b.beamsAll) bm.setContext(ctx).draw();
      if (nParts > 1) {
        new StaveConnector(staves[0], staves[nParts - 1]).setType(first ? StaveConnector.type.BRACKET : StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
        if (first) new StaveConnector(staves[0], staves[nParts - 1]).setType(StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
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
      x += width;
    });
    // Schlussstrich rechts je System
    if (nParts > 1 && allStaves.length) {
      const last = allStaves[allStaves.length - 1];
      new StaveConnector(last[0], last[nParts - 1]).setType(si === systems.length - 1 ? StaveConnector.type.BOLD_DOUBLE_RIGHT : StaveConnector.type.SINGLE_RIGHT).setContext(ctx).draw();
    }
  });
  for (const t of tieQueue) {
    try {
      const sameSystem = t.firstNote.getStave() && t.lastNote.getStave() && Math.abs(t.firstNote.getStave().getY() - t.lastNote.getStave().getY()) < 1;
      if (sameSystem) {
        new StaveTie({ firstNote: t.firstNote, lastNote: t.lastNote, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
      } else {
        // Bindung über den Zeilenumbruch: zwei halbe Bögen
        new StaveTie({ firstNote: t.firstNote, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
        new StaveTie({ lastNote: t.lastNote, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
      }
    } catch (e) { /* Bindung nicht darstellbar */ }
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
