import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Pair, Ring } from 'polygon-clipping';
import { clamp } from '../lib/geometry';
import { createId } from '../lib/id';
import { DEFAULT_OUTLINE_WIDTH } from '../types/map';
import type { EdgeOutline, FilledObject, MapObject, Point } from '../types/map';
import type { MapContent, MapDocument } from '../types/project';

export const findShape = (shapes: MapObject[], id: string | null): MapObject | null =>
  id === null ? null : (shapes.find((s) => s.id === id) ?? null);

/** Replace one shape, leaving every other shape (and its identity) untouched. */
export function mapShape(doc: MapDocument, id: string, fn: (s: MapObject) => MapObject): MapDocument {
  return { ...doc, shapes: doc.shapes.map((s) => (s.id === id ? fn(s) : s)) };
}

export const snapshot = (doc: MapDocument): MapContent => ({ shapes: doc.shapes, background: doc.background });

export function closedRing(points: Point[]): Ring {
  const ring = points.map(([x, y]) => [x, y] as Pair);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([first[0], first[1]]);
  return ring;
}

export function cleanRing(ring: Ring): Point[] {
  const points = ring.slice();
  if (points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) points.pop();
  const clean: Point[] = [];
  for (const [x, y] of points) {
    const previous = clean[clean.length - 1];
    if (!previous || Math.hypot(x - previous[0], y - previous[1]) > 1e-6) clean.push([x, y]);
  }
  return clean.length >= 3 ? clean : [];
}

export function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dy * t));
}

export function clippedEdgeStyles(shape: Extract<MapObject, { type: 'poly' | 'rect' }>, ring: Point[]) {
  const edgeOutlines: EdgeOutline[] = [];
  const edgeWidths: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const sourceEdge = shape.pts.findIndex((start, edgeIndex) => {
      const end = shape.pts[(edgeIndex + 1) % shape.pts.length];
      return pointSegmentDistance(a, start, end) < 1e-5 && pointSegmentDistance(b, start, end) < 1e-5;
    });
    edgeOutlines.push(sourceEdge >= 0 ? (shape.edgeOutlines?.[sourceEdge] ?? shape.outline) : 'none');
    edgeWidths.push(sourceEdge >= 0 ? (shape.edgeWidths?.[sourceEdge] ?? shape.outlineWidth ?? DEFAULT_OUTLINE_WIDTH) : (shape.outlineWidth ?? DEFAULT_OUTLINE_WIDTH));
  }
  return { edgeOutlines, edgeWidths };
}

export function geometryShapes(
  shape: Extract<MapObject, { type: 'poly' | 'rect' }>,
  geometry: MultiPolygon,
  detached: boolean,
  groupId: string | undefined,
): MapObject[] {
  const output: MapObject[] = [];
  for (const polygon of geometry) {
    const pts = cleanRing(polygon[0]);
    if (!pts.length) continue;
    const holes = polygon.slice(1).map(cleanRing).filter((ring) => ring.length >= 3);
    const styles = clippedEdgeStyles(shape, pts);
    const baseName = shape.name?.trim();
    const name = detached ? (baseName ? `${baseName} detached`.slice(0, 60) : undefined) : baseName;
    output.push({
      ...shape,
      id: detached || output.length > 0 ? createId() : shape.id,
      type: 'poly',
      pts,
      holes: holes.length ? holes : undefined,
      edgeOutlines: styles.edgeOutlines,
      edgeWidths: styles.edgeWidths,
      edgeGaps: undefined,
      erasures: undefined,
      detached: true,
      name,
      groupId: detached ? groupId : shape.groupId,
      groupName: detached ? 'Detached area' : shape.groupName,
    });
  }
  return output;
}

type CutoutShape = Extract<MapObject, { type: 'poly' | 'rect' | 'circle' }>;

export function polygonizedShape(shape: CutoutShape): Extract<MapObject, { type: 'poly' | 'rect' }> {
  if (shape.type !== 'circle') return shape;
  const [cx, cy] = shape.pts[0];
  const [hx, hy] = shape.pts[1];
  const radius = Math.hypot(hx - cx, hy - cy);
  const sides = 64;
  const baseAngle = Math.atan2(hy - cy, hx - cx) - (Math.PI * 2) / sides;
  const pts = Array.from({ length: sides }, (_, i): Point => {
    const angle = baseAngle + (Math.PI * 2 * i) / sides;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
  const outline = shape.edgeOutlines?.[0] ?? shape.outline;
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

export function filledGeometry(shape: CutoutShape): MultiPolygon {
  const polygon = polygonizedShape(shape);
  return [[closedRing(polygon.pts), ...(polygon.holes ?? []).map(closedRing)]];
}

export function subtractCutout(shape: MapObject, cutter: MultiPolygon): { pieces: MapObject[]; changed: boolean } {
  if (shape.hidden || (shape.type !== 'poly' && shape.type !== 'rect' && shape.type !== 'circle')) return { pieces: [shape], changed: false };
  const polygon = polygonizedShape(shape);
  const source: MultiPolygon = [[closedRing(polygon.pts), ...(polygon.holes ?? []).map(closedRing)]];
  const overlap = polygonClipping.intersection(source, cutter);
  if (!overlap.length) return { pieces: [shape], changed: false };
  const difference = polygonClipping.difference(source, cutter);
  const pieces = geometryShapes(polygon, difference, false, shape.groupId).map((piece) => ({
    ...piece,
    detached: shape.detached,
    groupName: shape.groupName,
  }));
  return { pieces, changed: true };
}

export function bakeLegacyCutoutLayers(shapes: MapObject[]): MapObject[] {
  let baked: MapObject[] = [];
  for (const shape of shapes) {
    if ((shape.type !== 'poly' && shape.type !== 'rect' && shape.type !== 'circle') || shape.kind !== 'cut') {
      baked.push(shape);
      continue;
    }
    if (shape.hidden) continue;
    const cutter = filledGeometry(shape);
    baked = baked.flatMap((lowerShape) => subtractCutout(lowerShape, cutter).pieces);
  }
  return baked;
}

// Shapes are never mutated in place, so a snapshot only needs to keep references.
export function sameContent(a: MapContent, b: MapContent): boolean {
  if (a.background !== b.background) return false;
  return a.shapes === b.shapes || JSON.stringify(a.shapes) === JSON.stringify(b.shapes);
}
