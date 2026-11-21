import type { ThemeMode } from '../lib/storage';
import type { Draft, FilledObject, LabelObject, MapObject, Outline, Point, SurfaceKind, Tool, XY } from '../types/map';
import type { Background, MapContent, MapDocument } from '../types/project';
export interface ViewState {
  /** Screen pixels per map unit. */
  scale: number;
  /** Screen-space offset of the sheet origin. */
  x: number;
  y: number;
}

export interface Viewport {
  w: number;
  h: number;
}

export type LabelPatch = Partial<Pick<LabelObject, 'text' | 'size' | 'tone'>>;

export interface HoverTarget {
  shapeId: string;
  part: 'body' | 'edge' | 'vertex' | 'rotate';
  index?: number;
  ring?: number;
}

export interface EditorState {
  /** 'loading' until the autosave has been restored; autosave is paused while loading. */
  status: 'loading' | 'ready';

  // --- persistent document (saved, exported, tracked by undo/redo) ---
  doc: MapDocument;

  // --- transient UI state (never saved) ---
  selectedId: string | null;
  selectedEdgeIndex: number | null;
  hoverTarget: HoverTarget | null;
  marqueeSelection: string[];
  selectionBox: { a: Point; b: Point } | null;
  eraserMode: 'area' | 'edges';
  groupingSelection: string[];
  tool: Tool;
  kind: SurfaceKind;
  grid: boolean;
  snap: boolean;
  gridSize: number;
  altKey: boolean;
  spaceHeld: boolean;
  draft: Draft | null;
  cursor: XY | null;
  rawCursor: XY | null;
  view: ViewState;
  viewport: Viewport;
  autoFit: boolean;
  theme: ThemeMode;
  toast: { id: number; message: string } | null;

  // --- history ---
  past: MapContent[];
  future: MapContent[];
  pending: MapContent | null;

  // --- actions ---
  hydrate: (doc: MapDocument) => void;
  showToast: (message: string) => void;
  clearToast: (id: number) => void;
  setTheme: (t: ThemeMode) => void;

  setTool: (t: Tool) => void;
  setKind: (k: SurfaceKind) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGridSize: (n: number) => void;
  setAlt: (alt: boolean) => void;
  setSpaceHeld: (held: boolean) => void;
  setCursor: (snapped: XY | null, raw: XY | null) => void;
  setDraft: (d: Draft | null) => void;
  select: (id: string | null) => void;
  setMarqueeSelection: (ids: string[]) => void;
  setSelectionBox: (box: { a: Point; b: Point } | null) => void;
  setEraserMode: (mode: 'area' | 'edges') => void;
  selectEdge: (index: number | null) => void;
  setHoverTarget: (target: HoverTarget | null) => void;
  toggleGroupingSelection: (id: string) => void;
  groupSelectedLayers: () => void;
  addLayerToGroup: (layerId: string, groupId: string) => void;
  renameLayer: (layerId: string, name: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  reorderGroup: (groupId: string, targetId: string, targetType: 'group' | 'layer', placement: 'before' | 'after') => void;
  reorderLayer: (layerId: string, targetId: string, targetType: 'group' | 'layer', placement: 'before' | 'after') => void;
  ungroupSelectedLayers: () => void;

  setViewport: (w: number, h: number) => void;
  fitView: () => void;
  zoomAt: (factor: number, cx?: number, cy?: number) => void;
  panBy: (dx: number, dy: number) => void;

  checkpoint: () => void;
  commit: () => void;
  /** Apply a document change as a single undoable step. */
  act: (fn: (doc: MapDocument) => MapDocument) => void;
  /** Apply a change without recording history; call checkpoint() before and commit() after. */
  liveEdit: (fn: (doc: MapDocument) => MapDocument) => void;
  undo: () => void;
  redo: () => void;

  setName: (name: string) => void;
  newProject: () => void;
  openDocument: (doc: MapDocument) => void;
  resetSheetForOfficialMap: (mapName: string) => void;
  addShape: (shape: MapObject) => void;
  cutoutArea: (cutter: FilledObject, beforeShapeId?: string) => void;
  addPolygonVertex: (id: string, edgeIndex: number, t: number, point: Point) => void;
  detachPolygonsInBox: (a: Point, b: Point) => void;
  finishPolygon: () => void;
  removeSelected: () => void;
  reorderSelected: (dir: 1 | -1) => void;
  duplicateSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  toggleHidden: (id: string) => void;
  patchLabel: (id: string, patch: LabelPatch) => void;
  patchElevation: (id: string, elevation: number) => void;
  setSelectedOutlineWidth: (width: number) => void;
  setSelectedOutline: (outline: Outline) => void;
  setSelectedEdgeOutline: (outline: Outline) => void;
  addErasurePoint: (id: string, point: Point, startNewStroke: boolean) => void;
  addCutoutPoints: (updates: Array<{ id: string; point: Point; startNewStroke: boolean }>) => void;
  addPolygonEdgeGap: (id: string, edgeIndex: number, t: number, previousT?: number) => void;
  finalizePolygonEdgeGaps: (id: string) => void;
  setBackground: (bg: Background | null) => void;
  patchBackground: (patch: Partial<Background>) => void;
}

