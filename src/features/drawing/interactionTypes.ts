import type { MapObject, Point, XY } from '../../types/map';

/** Per-pointer gesture state shared by tool handlers and the canvas event lifecycle. */
export type Drag =
  | { mode: 'pan'; x: number; y: number }
  | { mode: 'move'; start: XY; members: Array<{ id: string; pts: Point[]; holes?: Point[][]; erasures?: Point[][]; cutouts?: Point[][] }> }
  | { mode: 'erase-boundaries'; onlyPolygon: boolean; paths: Map<string, { activePath: boolean; edgeIndex?: number; lastT?: number }> }
  | { mode: 'erase-area'; last: XY; active: Map<string, boolean>; checkpointed: boolean }
  | { mode: 'box-select'; start: XY; end: XY }
  | { mode: 'detach-area'; start: XY; end: XY }
  | { mode: 'rotate'; id: string; center: Point; startAngle: number; original: MapObject }
  | { mode: 'vertex'; id: string; index: number; free: boolean };
