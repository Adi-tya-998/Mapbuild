import { SHEET_SIZE } from '../types/map';
import type { LabelObject, MapObject, Point, XY } from '../types/map';

/** Screen-pixel radius used for vertex/edge hit testing and the on-screen handle size. */
export const HIT_PX = 9;
export const HANDLE_PX = 7;
export const LABEL_FONT = '"IBM Plex Sans", sans-serif';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function rectPts(x0: number, y0: number, x1: number, y1: number): Point[] {
  const a = Math.min(x0, x1);
  const b = Math.min(y0, y1);
  const c = Math.max(x0, x1);
  const d = Math.max(y0, y1);
  return [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ];
}

export function circleRadius(pts: Point[]): number {
  return pts.length < 2 ? 0 : Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
}

export interface SnapOptions {
  snap: boolean;
  /** Alt held: ignore snapping and round to 0.1 unit instead. */
  alt: boolean;
  gridSize: number;
}

export function snapValue(v: number, o: SnapOptions): number {
  const r = o.snap && !o.alt ? Math.round(v / o.gridSize) * o.gridSize : Math.round(v * 10) / 10;
  return clamp(r, 0, SHEET_SIZE);
}

export function pointInPolygon(p: XY, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a[1] > p.y !== b[1] > p.y && p.x < ((b[0] - a[0]) * (p.y - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function measureWidth(font: string, text: string): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return text.length * 6;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bounding box of a label in map units (also used for rendering so hit area matches what is drawn). */
export function labelBox(s: LabelObject): Box {
  const width = Math.max(s.size * 0.6, measureWidth(`600 ${s.size}px ${LABEL_FONT}`, s.text || ' ')) + 2;
  const height = s.size * 1.2;
  const [cx, cy] = s.pts[0];
  return { x0: cx - width / 2, y0: cy - height / 2, x1: cx + width / 2, y1: cy + height / 2 };
}

/** Topmost visible object under the point (later objects are drawn on top). */
export function hitTest(shapes: MapObject[], p: XY, scale = 1): MapObject | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.hidden) continue;
    if (s.type === 'label') {
      const b = labelBox(s);
      if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) return s;
    } else if (s.type === 'circle') {
      if (Math.hypot(p.x - s.pts[0][0], p.y - s.pts[0][1]) <= circleRadius(s.pts) + HIT_PX / scale) return s;
    } else if (s.type === 'line' || s.type === 'curve') {
      for (let j = 0; j < s.pts.length - 1; j++) {
        if (segmentDistance(p, s.pts[j], s.pts[j + 1]).d * scale <= HIT_PX) return s;
      }
    } else {
      if (pointInPolygon(p, s.pts) || (nearestEdge(s.pts, p)?.d ?? Infinity) * scale <= HIT_PX) return s;
    }
  }
  return null;
}

export function hitVertex(s: MapObject, p: XY, scale: number): number {
  if (s.type === 'circle') {
    return Math.hypot(p.x - s.pts[1][0], p.y - s.pts[1][1]) * scale <= HIT_PX ? 1 : -1;
  }
  for (let i = 0; i < s.pts.length; i++) {
    if (Math.hypot(p.x - s.pts[i][0], p.y - s.pts[i][1]) * scale <= HIT_PX) return i;
  }
  return -1;
}

export interface EdgeHit {
  d: number;
  /** Index of the edge's first vertex; a new point goes at index + 1. */
  i: number;
  x: number;
  y: number;
  /** Normalized position from the edge's first vertex to its next vertex. */
  t: number;
}

function segmentDistance(p: XY, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2, 0, 1) : 0;
  const qx = a[0] + t * dx;
  const qy = a[1] + t * dy;
  return { d: Math.hypot(p.x - qx, p.y - qy), x: qx, y: qy, t };
}

export function nearestEdge(pts: Point[], p: XY): EdgeHit | null {
  return nearestPathEdge(pts, p, true);
}

/** Closest segment on an open path or closed polygon. */
export function nearestPathEdge(pts: Point[], p: XY, closed: boolean): EdgeHit | null {
  let best: EdgeHit | null = null;
  const count = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const r = segmentDistance(p, pts[i], pts[(i + 1) % pts.length]);
    if (!best || r.d < best.d) best = { d: r.d, i, x: r.x, y: r.y, t: r.t };
  }
  return best;
}

export function sizeOf(s: MapObject): { w: number; h: number } {
  if (s.type === 'label') {
    const b = labelBox(s);
    return { w: b.x1 - b.x0, h: b.y1 - b.y0 };
  }
  if (s.type === 'circle') {
    const diameter = circleRadius(s.pts) * 2;
    return { w: diameter, h: diameter };
  }
  const xs = s.pts.map((p) => p[0]);
  const ys = s.pts.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Resize a rectangle by dragging corner i; the opposite corner stays fixed. Returns new points. */
export function moveRectCorner(pts: Point[], i: number, p: XY): Point[] {
  const q = pts.map((pt) => [pt[0], pt[1]] as Point);
  q[i] = [p.x, p.y];
  if (i === 0) {
    q[1][1] = p.y;
    q[3][0] = p.x;
  } else if (i === 1) {
    q[0][1] = p.y;
    q[2][0] = p.x;
  } else if (i === 2) {
    q[1][0] = p.x;
    q[3][1] = p.y;
  } else {
    q[0][0] = p.x;
    q[2][1] = p.y;
  }
  return q;
}

export function translate(pts: Point[], dx: number, dy: number): Point[] {
  return pts.map((p) => [p[0] + dx, p[1] + dy] as Point);
}

/** Flat [x0, y0, x1, y1, ...] array as used by Konva lines. */
export function flatten(pts: Point[]): number[] {
  const out: number[] = [];
  for (const p of pts) out.push(p[0], p[1]);
  return out;
}

export interface FitResult {
  scale: number;
  x: number;
  y: number;
}

/** View transform that centres the sheet in a viewport with a small margin. */
export function fitTransform(width: number, height: number, margin = 12): FitResult {
  const avail = Math.max(120, Math.min(width, height) - margin * 2);
  const scale = avail / SHEET_SIZE;
  return { scale, x: (width - SHEET_SIZE * scale) / 2, y: (height - SHEET_SIZE * scale) / 2 };
}
