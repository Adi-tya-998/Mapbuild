import { createId } from '../../lib/id';
import { rectPts } from '../../lib/geometry';
import type { LabelObject, MapObject, Point, PolygonObject, RectObject, SurfaceKind } from '../../types/map';
import type { MapDocument } from '../../types/project';

const R = (kind: SurfaceKind, x0: number, y0: number, x1: number, y1: number): RectObject => ({
  id: createId(),
  type: 'rect',
  kind,
  pts: rectPts(x0, y0, x1, y1),
});
const P = (kind: SurfaceKind, pts: Point[]): PolygonObject => ({ id: createId(), type: 'poly', kind, pts });
const L = (text: string, x: number, y: number, size: number): LabelObject => ({
  id: createId(),
  type: 'label',
  pts: [[x, y]],
  text,
  size,
  tone: 'light',
});

export function emptyDocument(name = 'Untitled map'): MapDocument {
  return { name, shapes: [], background: null };
}

/** The example map shown on first launch (ported from the original editor). */
export function sampleDocument(): MapDocument {
  const shapes: MapObject[] = [
    R('floor', 14, 128, 52, 232),
    R('floor', 308, 128, 346, 232),
    R('floor', 52, 48, 84, 312),
    R('floor', 276, 48, 308, 312),
    R('floor', 84, 48, 276, 80),
    R('floor', 84, 280, 276, 312),
    R('floor', 84, 164, 276, 196),
    P('floor', [[84, 80], [112, 80], [152, 164], [124, 164]]),
    P('floor', [[276, 80], [248, 80], [208, 164], [236, 164]]),
    R('lane', 150, 164, 210, 196),
    R('site', 146, 48, 214, 80),
    R('site', 146, 280, 214, 312),
    R('cut', 24, 170, 38, 190),
    R('cut', 322, 170, 336, 190),
    L('A', 180, 64, 18),
    L('B', 180, 296, 18),
    L('MID', 180, 180, 11),
    L('ATK', 33, 148, 9),
    L('DEF', 327, 148, 9),
  ];
  return { name: 'Example map', shapes, background: null };
}
