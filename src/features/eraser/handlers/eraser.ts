import { circleRadius, labelBox, nearestPathEdge, pointInPolygon } from '../../../lib/geometry';
import type { EditorState } from '../../../stores/editorStore';
import { ERASER_WIDTH } from '../../../types/map';
import type { MapObject, Point, XY } from '../../../types/map';
import type { Drag } from '../../canvas';

const ERASER_HIT_PX = 8;

function nearestBoundary(shape: MapObject, p: XY): { distance: number; point: Point; edgeIndex?: number; t?: number } | null {
  if (shape.type === 'label') return null;
  if (shape.type === 'circle') {
    if ((shape.edgeOutlines?.[0] ?? shape.outline) === 'none') return null;
    const dx = p.x - shape.pts[0][0];
    const dy = p.y - shape.pts[0][1];
    const radius = circleRadius(shape.pts);
    const distanceFromCenter = Math.hypot(dx, dy);
    const directionX = distanceFromCenter === 0 ? 1 : dx / distanceFromCenter;
    const directionY = distanceFromCenter === 0 ? 0 : dy / distanceFromCenter;
    return { distance: Math.abs(distanceFromCenter - radius), point: [shape.pts[0][0] + directionX * radius, shape.pts[0][1] + directionY * radius] };
  }
  if (shape.type === 'poly' || shape.type === 'rect') {
    let best: { distance: number; point: Point; edgeIndex: number; t: number } | null = null;
    for (let i = 0; i < shape.pts.length; i++) {
      if ((shape.edgeOutlines?.[i] ?? shape.outline) === 'none') continue;
      const hit = nearestPathEdge([shape.pts[i], shape.pts[(i + 1) % shape.pts.length]], p, false);
      if (hit && (!best || hit.d < best.distance)) best = { distance: hit.d, point: [hit.x, hit.y], edgeIndex: i, t: hit.t };
    }
    return best;
  }
  if ((shape.edgeOutlines?.[0] ?? shape.outline) === 'none') return null;
  const hit = nearestPathEdge(shape.pts, p, false);
  return hit ? { distance: hit.d, point: [hit.x, hit.y], t: hit.t } : null;
}

function shapeUnderBrush(shape: MapObject, p: XY, radius: number): boolean {
  if (shape.hidden) return false;
  if (shape.type === 'label') {
    const box = labelBox(shape);
    return p.x >= box.x0 - radius && p.x <= box.x1 + radius && p.y >= box.y0 - radius && p.y <= box.y1 + radius;
  }
  if (shape.type === 'circle') return Math.hypot(p.x - shape.pts[0][0], p.y - shape.pts[0][1]) <= circleRadius(shape.pts) + radius;
  if (shape.type === 'line' || shape.type === 'curve') {
    return (nearestPathEdge(shape.pts, p, false)?.d ?? Infinity) <= radius + (shape.outlineWidth ?? 0.75) / 2;
  }
  const insideOuter = pointInPolygon(p, shape.pts);
  const insideHole = shape.holes?.some((ring) => pointInPolygon(p, ring)) ?? false;
  const nearHole = shape.holes?.some((ring) => (nearestPathEdge(ring, p, true)?.d ?? Infinity) <= radius) ?? false;
  return (insideOuter && !insideHole) || (nearestPathEdge(shape.pts, p, true)?.d ?? Infinity) <= radius || nearHole;
}

function eraseAreaAlongPath(s: EditorState, from: XY, to: XY, drag: Extract<Drag, { mode: 'erase-area' }>): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(0.35, ERASER_WIDTH / 3)));
  const updates: Array<{ id: string; point: Point; startNewStroke: boolean }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point: Point = [from.x + dx * t, from.y + dy * t];
    const hits = s.doc.shapes.filter((shape) => shapeUnderBrush(shape, { x: point[0], y: point[1] }, ERASER_WIDTH / 2));
    const hitIds = new Set(hits.map((shape) => shape.id));
    for (const id of drag.active.keys()) if (!hitIds.has(id)) drag.active.set(id, false);
    for (const shape of hits) {
      updates.push({ id: shape.id, point, startNewStroke: !drag.active.get(shape.id) });
      drag.active.set(shape.id, true);
    }
  }
  if (!updates.length) return;
  if (!drag.checkpointed) {
    s.select(null);
    s.checkpoint();
    drag.checkpointed = true;
  }
  s.addCutoutPoints(updates);
}

function boundaryHits(shapes: MapObject[], p: XY, scale: number, onlyPolygon: boolean) {
  const hits: Array<{ shape: MapObject; edge: NonNullable<ReturnType<typeof nearestBoundary>> }> = [];
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape.hidden || (onlyPolygon && shape.type !== 'poly' && shape.type !== 'rect')) continue;
    const edge = nearestBoundary(shape, p);
    if (edge && edge.distance * scale <= ERASER_HIT_PX) hits.push({ shape, edge });
  }
  return hits;
}

function eraseBoundaryHits(
  s: EditorState,
  hits: ReturnType<typeof boundaryHits>,
  paths: Extract<Drag, { mode: 'erase-boundaries' }>['paths'],
) {
  const currentIds = new Set(hits.map(({ shape }) => shape.id));
  for (const [id] of paths) if (!currentIds.has(id)) paths.set(id, { activePath: false });
  for (const { shape, edge } of hits) {
    const previous = paths.get(shape.id);
    if (edge.edgeIndex !== undefined && edge.t !== undefined) {
      const continueSameEdge = previous?.activePath && previous.edgeIndex === edge.edgeIndex;
      s.addPolygonEdgeGap(shape.id, edge.edgeIndex, edge.t, continueSameEdge ? previous.lastT : undefined);
      paths.set(shape.id, { activePath: true, edgeIndex: edge.edgeIndex, lastT: edge.t });
    } else {
      s.addErasurePoint(shape.id, edge.point, !previous?.activePath);
      paths.set(shape.id, { activePath: true });
    }
  }
}

export function beginEraser(s: EditorState, p: XY, ctrlKey: boolean): Drag | null {
  if (!ctrlKey && s.eraserMode === 'area') {
    const areaDrag: Extract<Drag, { mode: 'erase-area' }> = { mode: 'erase-area', last: p, active: new Map(), checkpointed: false };
    eraseAreaAlongPath(s, p, p, areaDrag);
    return areaDrag;
  }
  const onlyPolygon = !ctrlKey && s.eraserMode === 'edges';
  const hits = boundaryHits(s.doc.shapes, p, s.view.scale, onlyPolygon);
  if (!hits.length) return null;
  const paths = new Map<string, { activePath: boolean; edgeIndex?: number; lastT?: number }>();
  s.select(hits[0].shape.id);
  s.checkpoint();
  eraseBoundaryHits(s, hits, paths);
  return { mode: 'erase-boundaries', onlyPolygon, paths };
}

export function moveEraser(s: EditorState, p: XY, drag: Extract<Drag, { mode: 'erase-area' | 'erase-boundaries' }>): void {
  if (drag.mode === 'erase-area') {
    eraseAreaAlongPath(s, drag.last, p, drag);
    drag.last = p;
  } else {
    eraseBoundaryHits(s, boundaryHits(s.doc.shapes, p, s.view.scale, drag.onlyPolygon), drag.paths);
  }
}

export function finishBoundaryEraser(s: EditorState, drag: Extract<Drag, { mode: 'erase-boundaries' }>): void {
  for (const id of drag.paths.keys()) s.finalizePolygonEdgeGaps(id);
}
