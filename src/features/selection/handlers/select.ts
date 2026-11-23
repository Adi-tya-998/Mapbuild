import { circleRadius, hitTest, hitVertex, labelBox, moveRectCorner, nearestPathEdge, pointInPolygon, pointsCenter, rotatePoints, rotationHandlePoint, HIT_PX } from '../../../lib/geometry';
import { findShape, mapShape } from '../../../stores/editorStore';
import type { EditorState, HoverTarget } from '../../../stores/editorStore';
import { DEFAULT_OUTLINE_WIDTH } from '../../../types/map';
import type { MapObject, Point, XY } from '../../../types/map';
import type { Drag } from '../../../lib/editorInteraction';

function circleAsPolygon(shape: Extract<MapObject, { type: 'circle' }>): Extract<MapObject, { type: 'poly' }> {
  const [cx, cy] = shape.pts[0];
  const [hx, hy] = shape.pts[1];
  const radius = circleRadius(shape.pts);
  const sides = 48;
  const angle = Math.atan2(hy - cy, hx - cx) - (Math.PI * 2) / sides;
  const pts = Array.from({ length: sides }, (_, i): Point => {
    const at = angle + (Math.PI * 2 * i) / sides;
    return [cx + Math.cos(at) * radius, cy + Math.sin(at) * radius];
  });
  const outline = shape.edgeOutlines?.[0] ?? shape.outline ?? 'none';
  const width = shape.edgeWidths?.[0] ?? shape.outlineWidth ?? DEFAULT_OUTLINE_WIDTH;
  return {
    ...shape,
    type: 'poly',
    pts,
    outline,
    outlineWidth: width,
    edgeOutlines: Array.from({ length: sides }, () => outline),
    edgeWidths: Array.from({ length: sides }, () => width),
    edgeGaps: undefined,
  };
}

function rotateShape(shape: MapObject, center: Point, angle: number): MapObject {
  if (shape.type === 'label' || shape.type === 'circle') return shape;
  const pts = rotatePoints(shape.pts, center, angle);
  const holes = shape.holes?.map((ring) => rotatePoints(ring, center, angle));
  const rotateStrokes = (strokes: Point[][] | undefined) => strokes?.map((stroke) => rotatePoints(stroke, center, angle));
  const geometry = {
    pts,
    ...(holes ? { holes } : {}),
    ...(shape.erasures ? { erasures: rotateStrokes(shape.erasures) } : {}),
    ...(shape.cutouts ? { cutouts: rotateStrokes(shape.cutouts) } : {}),
  };
  return shape.type === 'rect' ? { ...shape, ...geometry, type: 'poly' } : { ...shape, ...geometry };
}

function vertexAddress(shape: MapObject, vertexIndex: number): Pick<HoverTarget, 'index' | 'ring'> {
  if (vertexIndex < shape.pts.length) return { index: vertexIndex, ring: 0 };
  let index = vertexIndex - shape.pts.length;
  for (let ring = 0; ring < (shape.type === 'poly' || shape.type === 'rect' ? shape.holes?.length ?? 0 : 0); ring++) {
    const points = shape.type === 'poly' || shape.type === 'rect' ? shape.holes?.[ring] ?? [] : [];
    if (index < points.length) return { index, ring: ring + 1 };
    index -= points.length;
  }
  return { index: vertexIndex, ring: 0 };
}

export function selectHoverTargetAt(shapes: MapObject[], p: XY, scale: number, selectedId: string | null): HoverTarget | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape.hidden) continue;
    if (shape.id === selectedId && (shape.type === 'poly' || shape.type === 'rect' || shape.type === 'line' || shape.type === 'curve')) {
      const [x, y] = rotationHandlePoint(shape.pts, scale);
      if (Math.hypot(p.x - x, p.y - y) * scale <= 12) return { shapeId: shape.id, part: 'rotate' };
    }
    if (shape.type !== 'label') {
      const vertex = hitVertex(shape, p, scale);
      if (vertex >= 0) return { shapeId: shape.id, part: 'vertex', ...vertexAddress(shape, vertex) };
    }
    if (shape.type === 'circle') {
      if (Math.abs(Math.hypot(p.x - shape.pts[0][0], p.y - shape.pts[0][1]) - circleRadius(shape.pts)) * scale <= HIT_PX) {
        return { shapeId: shape.id, part: 'edge', index: 0, ring: 0 };
      }
    } else if (shape.type === 'line' || shape.type === 'curve') {
      const edge = nearestPathEdge(shape.pts, p, false);
      if (edge && edge.d * scale <= HIT_PX) return { shapeId: shape.id, part: 'edge', index: edge.i, ring: 0 };
    } else if (shape.type === 'poly' || shape.type === 'rect') {
      const rings = [shape.pts, ...(shape.holes ?? [])];
      for (let ring = 0; ring < rings.length; ring++) {
        const edge = nearestPathEdge(rings[ring], p, true);
        if (edge && edge.d * scale <= HIT_PX) return { shapeId: shape.id, part: 'edge', index: edge.i, ring };
      }
    }
    if (hitTest([shape], p, scale)) return { shapeId: shape.id, part: 'body' };
  }
  return null;
}

export function selectionBoxIntersects(shape: MapObject, a: XY, b: XY): boolean {
  if (shape.hidden) return false;
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const inside = (point: Point) => point[0] >= x0 && point[0] <= x1 && point[1] >= y0 && point[1] <= y1;
  if (shape.type === 'label') {
    const box = labelBox(shape);
    return box.x0 <= x1 && box.x1 >= x0 && box.y0 <= y1 && box.y1 >= y0;
  }
  if (shape.type === 'circle') {
    const [cx, cy] = shape.pts[0];
    const closestX = Math.max(x0, Math.min(x1, cx));
    const closestY = Math.max(y0, Math.min(y1, cy));
    return Math.hypot(cx - closestX, cy - closestY) <= circleRadius(shape.pts);
  }
  const intersectsSegment = (from: Point, to: Point) => {
    let lo = 0;
    let hi = 1;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    for (const [p, q] of [[-dx, from[0] - x0], [dx, x1 - from[0]], [-dy, from[1] - y0], [dy, y1 - from[1]]] as const) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
      if (lo > hi) return false;
    }
    return true;
  };
  if (shape.pts.some(inside)) return true;
  const corners: Point[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if ((shape.type === 'poly' || shape.type === 'rect') && corners.some((point) =>
    pointInPolygon({ x: point[0], y: point[1] }, shape.pts) && !(shape.holes?.some((ring) => pointInPolygon({ x: point[0], y: point[1] }, ring)) ?? false),
  )) return true;
  const edgeCount = shape.type === 'poly' || shape.type === 'rect' ? shape.pts.length : shape.pts.length - 1;
  for (let i = 0; i < edgeCount; i++) if (intersectsSegment(shape.pts[i], shape.pts[(i + 1) % shape.pts.length])) return true;
  return false;
}

export function beginSelectTool(s: EditorState, p: XY, modifiers: Pick<PointerEvent, 'shiftKey' | 'altKey'>, host: Pick<HTMLDivElement, 'style'>): Drag | null {
  const selected = findShape(s.doc.shapes, s.selectedId);
  if (selected && (selected.type === 'poly' || selected.type === 'rect' || selected.type === 'line' || selected.type === 'curve')) {
    const [handleX, handleY] = rotationHandlePoint(selected.pts, s.view.scale);
    if (Math.hypot(p.x - handleX, p.y - handleY) * s.view.scale <= 12) {
      const center = pointsCenter(selected.pts);
      s.checkpoint();
      host.style.cursor = 'grabbing';
      return { mode: 'rotate', id: selected.id, center, startAngle: Math.atan2(p.y - center[1], p.x - center[0]), original: selected };
    }
  }
  const selectedShapes = s.selectedId
    ? [findShape(s.doc.shapes, s.selectedId)]
    : s.marqueeSelection.map((id) => findShape(s.doc.shapes, id)).reverse();
  const candidates = [...selectedShapes, ...s.doc.shapes.slice().reverse().filter((shape) => !selectedShapes.some((item) => item?.id === shape.id))];
  for (const shape of candidates) {
    if (!shape || shape.hidden || shape.type === 'label') continue;
    const vertex = hitVertex(shape, p, s.view.scale);
    if (vertex < 0) continue;
    if (modifiers.shiftKey) {
      if (shape.type !== 'rect' && vertex < shape.pts.length && shape.pts.length > 3) {
        s.act((doc) => mapShape(doc, shape.id, (item) => ({ ...item, pts: item.pts.filter((_, i) => i !== vertex) })));
        return null;
      }
      if (vertex >= shape.pts.length && (shape.type === 'poly' || shape.type === 'rect')) {
        let holeIndex = vertex - shape.pts.length;
        const ringIndex = (shape.holes ?? []).findIndex((ring) => {
          if (holeIndex < ring.length) return true;
          holeIndex -= ring.length;
          return false;
        });
        if (ringIndex >= 0 && (shape.holes?.[ringIndex]?.length ?? 0) > 3) {
          const indexInRing = holeIndex;
          s.act((doc) => mapShape(doc, shape.id, (item) => item.type === 'poly' || item.type === 'rect'
            ? { ...item, holes: item.holes?.map((ring, i) => i === ringIndex ? ring.filter((_, vertexIndex) => vertexIndex !== indexInRing) : ring) }
            : item));
          return null;
        }
      }
    }
    s.select(shape.id);
    s.checkpoint();
    return { mode: 'vertex', id: shape.id, index: vertex, free: modifiers.altKey };
  }

  const hit = hitTest(s.doc.shapes, p, s.view.scale);
  if (!hit) {
    s.select(null);
    return null;
  }
  s.select(hit.id);
  if (hit.type !== 'label') {
    let edgeIndex: number | null = null;
    if (hit.type === 'circle') {
      const distance = Math.abs(Math.hypot(p.x - hit.pts[0][0], p.y - hit.pts[0][1]) - circleRadius(hit.pts));
      if (distance * s.view.scale <= HIT_PX) edgeIndex = 0;
    } else {
      const edge = nearestPathEdge(hit.pts, p, hit.type === 'poly' || hit.type === 'rect');
      if (edge && edge.d * s.view.scale <= HIT_PX) edgeIndex = hit.type === 'line' || hit.type === 'curve' ? 0 : edge.i;
    }
    if (edgeIndex !== null) s.selectEdge(edgeIndex);
  }
  s.checkpoint();
  const members = hit.groupId ? s.doc.shapes.filter((shape) => shape.groupId === hit.groupId) : [hit];
  return {
    mode: 'move',
    start: p,
    members: members.map((shape) => ({
      id: shape.id,
      pts: shape.pts.map((q) => [q[0], q[1]] as Point),
      holes: shape.holes?.map((ring) => ring.map(([x, y]) => [x, y] as Point)),
      erasures: shape.erasures?.map((stroke) => stroke.map(([x, y]) => [x, y] as Point)),
      cutouts: shape.cutouts?.map((stroke) => stroke.map(([x, y]) => [x, y] as Point)),
    })),
  };
}

export function updateSelectDrag(s: EditorState, p: XY, snappedPoint: XY, drag: Extract<Drag, { mode: 'move' | 'rotate' | 'vertex' }>, snap: { snap: boolean; alt: boolean; gridSize: number }, snapValue: (value: number, options: typeof snap) => number): void {
  if (drag.mode === 'move') {
    const firstPoint = drag.members.find((member) => member.id === s.selectedId)?.pts[0] ?? drag.members[0]?.pts[0];
    if (!firstPoint) return;
    const rx = p.x - drag.start.x;
    const ry = p.y - drag.start.y;
    const dx = snap.snap && !snap.alt ? snapValue(firstPoint[0] + rx, snap) - firstPoint[0] : Math.round(rx * 10) / 10;
    const dy = snap.snap && !snap.alt ? snapValue(firstPoint[1] + ry, snap) - firstPoint[1] : Math.round(ry * 10) / 10;
    const originals = new Map(drag.members.map((member) => [member.id, member]));
    s.liveEdit((doc) => ({ ...doc, shapes: doc.shapes.map((shape) => {
      const original = originals.get(shape.id);
      return original ? {
        ...shape,
        pts: original.pts.map(([x, y]) => [x + dx, y + dy] as Point),
        ...(original.holes ? { holes: original.holes.map((ring) => ring.map(([x, y]) => [x + dx, y + dy] as Point)) } : {}),
        ...(original.erasures ? { erasures: original.erasures.map((stroke) => stroke.map(([x, y]) => [x + dx, y + dy] as Point)) } : {}),
        ...(original.cutouts ? { cutouts: original.cutouts.map((stroke) => stroke.map(([x, y]) => [x + dx, y + dy] as Point)) } : {}),
      } : shape;
    }) }));
    return;
  }
  if (drag.mode === 'rotate') {
    let angle = Math.atan2(p.y - drag.center[1], p.x - drag.center[0]) - drag.startAngle;
    if (angle > Math.PI) angle -= Math.PI * 2;
    if (angle < -Math.PI) angle += Math.PI * 2;
    s.liveEdit((doc) => mapShape(doc, drag.id, (shape) => rotateShape(drag.original, drag.center, angle)));
    return;
  }
  s.liveEdit((doc) => mapShape(doc, drag.id, (shape) => {
    if (shape.type === 'circle' && drag.free && drag.index === 1) {
      const polygon = circleAsPolygon(shape);
      return { ...polygon, pts: polygon.pts.map((q, i) => i === drag.index ? [snappedPoint.x, snappedPoint.y] as Point : q) };
    }
    if (shape.type === 'rect' && drag.index < shape.pts.length) {
      if (drag.free) return { ...shape, type: 'poly', pts: shape.pts.map((q, i) => i === drag.index ? [snappedPoint.x, snappedPoint.y] as Point : q) };
      return { ...shape, pts: moveRectCorner(shape.pts, drag.index, snappedPoint) };
    }
    if (drag.index < shape.pts.length) return { ...shape, pts: shape.pts.map((q, i) => i === drag.index ? [snappedPoint.x, snappedPoint.y] as Point : q) };
    if (shape.type === 'poly' || shape.type === 'rect') {
      let holeIndex = drag.index - shape.pts.length;
      const ringIndex = (shape.holes ?? []).findIndex((ring) => {
        if (holeIndex < ring.length) return true;
        holeIndex -= ring.length;
        return false;
      });
      if (ringIndex >= 0) {
        const indexInRing = holeIndex;
        return { ...shape, holes: shape.holes?.map((ring, i) => i === ringIndex ? ring.map((q, vertexIndex) => vertexIndex === indexInRing ? [snappedPoint.x, snappedPoint.y] as Point : q) : ring) };
      }
    }
    return shape;
  }));
}
