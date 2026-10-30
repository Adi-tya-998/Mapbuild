/** Side length of the square map sheet, in map units. All object coordinates use these units. */
export const SHEET_SIZE = 360;
/** Brush width, in map units, used by the boundary eraser. */
export const ERASER_WIDTH = 3.5;

export type Point = [number, number];
/** Normalized start/end positions along a polygon edge where its outline is open. */
export type EdgeGap = [number, number];
export interface XY {
  x: number;
  y: number;
}

export type SurfaceKind = 'floor' | 'lane' | 'site' | 'cut';

export const SURFACES: Record<SurfaceKind, { name: string; fill: string }> = {
  floor: { name: 'Floor', fill: '#767676' },
  lane: { name: 'Lane', fill: '#939393' },
  site: { name: 'Site', fill: '#9d9d63' },
  cut: { name: 'Cutout', fill: '#ffffff' },
};
export const SURFACE_KINDS = Object.keys(SURFACES) as SurfaceKind[];

/** Convert a surface's relative elevation into a darker/lighter fill color. */
export function elevationFill(kind: SurfaceKind, elevation = 0): string {
  if (kind === 'cut') return SURFACES[kind].fill;
  const hex = SURFACES[kind].fill.slice(1);
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const amount = Math.min(10, Math.abs(elevation)) / 10 * (elevation < 0 ? 0.58 : 0.38);
  const target = elevation < 0 ? 0 : 255;
  return `#${rgb.map((channel) => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export type Tool = 'select' | 'poly' | 'rect' | 'circle' | 'line' | 'curve' | 'point' | 'eraser' | 'label';
export type LabelTone = 'light' | 'dark';
export type Outline = 'none' | 'white' | 'black';
/** null is accepted because JSON.stringify serializes undefined array entries as null. */
export type EdgeOutline = Outline | null | undefined;
export const DEFAULT_OUTLINE_WIDTH = 1;
export const OUTLINE_WIDTH_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

interface ObjectBase {
  id: string;
  /** Optional user-defined label shown in the layers panel. */
  name?: string;
  /** Shapes with the same group id move together. */
  groupId?: string;
  /** Shared display name, copied to each member so groups remain portable in project files. */
  groupName?: string;
  hidden?: boolean;
  /** Optional edge treatment; omitted values retain the editor's original default appearance. */
  outline?: Outline;
  /** Stroke thickness in map units. Unset shapes use the slimmer app default. */
  outlineWidth?: number;
  /** Per-edge treatments override `outline`; closed shapes have one entry per side. */
  edgeOutlines?: EdgeOutline[];
  /** Per-edge stroke thicknesses override `outlineWidth`. */
  edgeWidths?: number[];
  /** Surface-colored strokes that erase only portions of this object's outline. */
  erasures?: Point[][];
  /** True outline openings, stored as normalized intervals for each closed-shape edge. */
  edgeGaps?: EdgeGap[][];
  /** Relative height used to shade filled surfaces; lower Z values render darker. */
  elevation?: number;
  /** Vertices in map units. Labels use a single point; rectangles use four corners (TL, TR, BR, BL). */
  pts: Point[];
}

export interface PolygonObject extends ObjectBase {
  type: 'poly';
  kind: SurfaceKind;
}
export interface RectObject extends ObjectBase {
  type: 'rect';
  kind: SurfaceKind;
}
export interface CircleObject extends ObjectBase {
  type: 'circle';
  kind: SurfaceKind;
}
export interface LineObject extends ObjectBase {
  type: 'line' | 'curve';
  kind: SurfaceKind;
}
export interface LabelObject extends ObjectBase {
  type: 'label';
  text: string;
  size: number;
  tone: LabelTone;
}

export type FilledObject = PolygonObject | RectObject | CircleObject;
export type MapObject = FilledObject | LineObject | LabelObject;

/** In-progress drawing, kept outside the document until it is committed. */
export type Draft =
  | { type: 'poly'; pts: Point[] }
  | { type: 'rect'; a: XY; b: XY }
  | { type: 'circle'; center: XY; edge: XY }
  | { type: 'line'; a: XY; b: XY }
  | { type: 'curve'; pts: Point[] };

export const LABEL_LIMITS = { minSize: 4, maxSize: 40, maxText: 40 } as const;
