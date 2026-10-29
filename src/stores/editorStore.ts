import { create } from 'zustand';
import { fitTransform, clamp } from '../lib/geometry';
import { createId } from '../lib/id';
import { loadTheme } from '../lib/storage';
import type { ThemeMode } from '../lib/storage';
import { DEFAULT_OUTLINE_WIDTH, ERASER_WIDTH, SHEET_SIZE } from '../types/map';
import type { Draft, EdgeGap, EdgeOutline, LabelObject, MapObject, Outline, Point, SurfaceKind, Tool, XY } from '../types/map';
import type { Background, MapContent, MapDocument } from '../types/project';
import { emptyDocument } from '../features/projects/sampleProject';

const HISTORY_LIMIT = 150;
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 24;

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

type LabelPatch = Partial<Pick<LabelObject, 'text' | 'size' | 'tone'>>;

export interface EditorState {
  /** 'loading' until the autosave has been restored; autosave is paused while loading. */
  status: 'loading' | 'ready';

  // --- persistent document (saved, exported, tracked by undo/redo) ---
  doc: MapDocument;

  // --- transient UI state (never saved) ---
  selectedId: string | null;
  selectedEdgeIndex: number | null;
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
  selectEdge: (index: number | null) => void;
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
  addPolygonEdgeGap: (id: string, edgeIndex: number, t: number, previousT?: number) => void;
  finalizePolygonEdgeGaps: (id: string) => void;
  setBackground: (bg: Background | null) => void;
  patchBackground: (patch: Partial<Background>) => void;
}

// ---------- helpers ----------

export const findShape = (shapes: MapObject[], id: string | null): MapObject | null =>
  id === null ? null : (shapes.find((s) => s.id === id) ?? null);

/** Replace one shape, leaving every other shape (and its identity) untouched. */
export function mapShape(doc: MapDocument, id: string, fn: (s: MapObject) => MapObject): MapDocument {
  return { ...doc, shapes: doc.shapes.map((s) => (s.id === id ? fn(s) : s)) };
}

const snapshot = (doc: MapDocument): MapContent => ({ shapes: doc.shapes, background: doc.background });

// Shapes are never mutated in place, so a snapshot only needs to keep references.
function sameContent(a: MapContent, b: MapContent): boolean {
  if (a.background !== b.background) return false;
  return a.shapes === b.shapes || JSON.stringify(a.shapes) === JSON.stringify(b.shapes);
}

const initialView = fitTransform(600, 600);

export const useEditorStore = create<EditorState>()((set, get) => ({
  status: 'loading',
  doc: emptyDocument(),

  selectedId: null,
  selectedEdgeIndex: null,
  groupingSelection: [],
  tool: 'select',
  kind: 'floor',
  grid: true,
  snap: true,
  gridSize: 2,
  altKey: false,
  spaceHeld: false,
  draft: null,
  cursor: null,
  rawCursor: null,
  view: initialView,
  viewport: { w: 0, h: 0 },
  autoFit: true,
  theme: loadTheme(),
  toast: null,

  past: [],
  future: [],
  pending: null,

  hydrate: (doc) => set({ doc, status: 'ready', past: [], future: [], pending: null, selectedId: null, selectedEdgeIndex: null, groupingSelection: [], draft: null }),
  showToast: (message) => set({ toast: { id: Date.now() + Math.random(), message } }),
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : {})),
  setTheme: (theme) => set({ theme }),

  setTool: (tool) => set({ tool, draft: null }),
  setKind: (kind) => {
    const s = get();
    const sel = findShape(s.doc.shapes, s.selectedId);
    set({ kind });
    if (sel && sel.type !== 'label' && s.tool === 'select') {
      s.act((doc) => mapShape(doc, sel.id, (o) => (o.type === 'label' ? o : { ...o, kind })));
    }
  },
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setGridSize: (gridSize) => set({ gridSize }),
  setAlt: (altKey) => {
    if (get().altKey !== altKey) set({ altKey });
  },
  setSpaceHeld: (spaceHeld) => {
    if (get().spaceHeld !== spaceHeld) set({ spaceHeld });
  },
  setCursor: (cursor, rawCursor) => set({ cursor, rawCursor }),
  setDraft: (draft) => set({ draft }),
  select: (selectedId) => set({ selectedId, selectedEdgeIndex: null }),
  selectEdge: (selectedEdgeIndex) => set({ selectedEdgeIndex }),
  toggleGroupingSelection: (id) => set((s) => ({ groupingSelection: s.groupingSelection.includes(id) ? s.groupingSelection.filter((item) => item !== id) : [...s.groupingSelection, id] })),
  groupSelectedLayers: () => {
    const s = get();
    const ids = new Set(s.groupingSelection.filter((id) => s.doc.shapes.some((shape) => shape.id === id)));
    if (ids.size < 2) return;
    const groupId = createId();
    s.act((doc) => ({ ...doc, shapes: doc.shapes.map((shape) => ids.has(shape.id) ? { ...shape, groupId, groupName: undefined } : shape) }));
    set({ groupingSelection: [] });
    get().showToast(`Grouped ${ids.size} layers. Their layer order is preserved; move any member to move them together.`);
  },
  addLayerToGroup: (layerId, groupId) => {
    const s = get();
    const targetExists = s.doc.shapes.some((shape) => shape.groupId === groupId);
    const layer = s.doc.shapes.find((shape) => shape.id === layerId);
    if (!targetExists || !layer || layer.groupId === groupId) return;
    s.act((doc) => {
      const groupName = doc.shapes.find((shape) => shape.groupId === groupId)?.groupName;
      const shapes = doc.shapes.map((shape) => shape.id === layerId ? { ...shape, groupId, groupName } : shape);
      const counts = new Map<string, number>();
      shapes.forEach((shape) => {
        if (shape.groupId) counts.set(shape.groupId, (counts.get(shape.groupId) ?? 0) + 1);
      });
      return { ...doc, shapes: shapes.map((shape) => shape.groupId && counts.get(shape.groupId) === 1 ? { ...shape, groupId: undefined, groupName: undefined } : shape) };
    });
    get().showToast('Layer added to group. Its stack position is unchanged.');
  },
  renameLayer: (layerId, name) => {
    const normalized = name.trim().slice(0, 60) || undefined;
    if (!get().doc.shapes.some((shape) => shape.id === layerId)) return;
    get().act((doc) => ({ ...doc, shapes: doc.shapes.map((shape) => shape.id === layerId ? { ...shape, name: normalized } : shape) }));
  },
  renameGroup: (groupId, name) => {
    const normalized = name.trim().slice(0, 60) || undefined;
    if (!get().doc.shapes.some((shape) => shape.groupId === groupId)) return;
    get().act((doc) => ({ ...doc, shapes: doc.shapes.map((shape) => shape.groupId === groupId ? { ...shape, groupName: normalized } : shape) }));
  },
  reorderGroup: (groupId, targetId, targetType, placement) => {
    const s = get();
    if (targetType === 'group' && groupId === targetId) return;
    const sourceMembers = s.doc.shapes.filter((shape) => shape.groupId === groupId);
    const targetMembers = targetType === 'group'
      ? s.doc.shapes.filter((shape) => shape.groupId === targetId)
      : s.doc.shapes.filter((shape) => shape.id === targetId);
    if (sourceMembers.length === 0 || targetMembers.length === 0 || targetMembers.some((shape) => shape.groupId === groupId)) return;
    s.act((doc) => {
      const remaining = doc.shapes.filter((shape) => shape.groupId !== groupId);
      const targetIndexes = remaining
        .map((shape, index) => (targetType === 'group' ? shape.groupId === targetId : shape.id === targetId) ? index : -1)
        .filter((index) => index >= 0);
      if (targetIndexes.length === 0) return doc;
      // The document stores layers back-to-front, opposite to the panel's top-down order.
      const insertionIndex = placement === 'before'
        ? Math.max(...targetIndexes) + 1
        : Math.min(...targetIndexes);
      remaining.splice(insertionIndex, 0, ...sourceMembers);
      return { ...doc, shapes: remaining };
    });
  },
  reorderLayer: (layerId, targetId, targetType, placement) => {
    const s = get();
    const layer = s.doc.shapes.find((shape) => shape.id === layerId);
    if (!layer || (targetType === 'layer' && layerId === targetId)) return;
    s.act((doc) => {
      const remaining = doc.shapes.filter((shape) => shape.id !== layerId);
      const targetItems = targetType === 'group'
        ? remaining.filter((shape) => shape.groupId === targetId)
        : remaining.filter((shape) => shape.id === targetId);
      if (targetItems.length === 0) return doc;
      // A drop on the folder header only changes stack position; nesting is explicit
      // by dropping on a member row or using the group's add-layer control.
      // Dragging an ungrouped layer past or onto a grouped row must not silently
      // add it to that group. Use the group's + control for explicit membership.
      // An already grouped layer can still move between groups by dropping on a
      // member row, or leave a group by dropping on an ungrouped row.
      const nextGroupId = targetType === 'group' || !layer.groupId
        ? layer.groupId
        : targetItems[0].groupId;
      const nextGroupName = targetType === 'group' || !layer.groupId
        ? layer.groupName
        : targetItems[0].groupId ? targetItems[0].groupName : undefined;
      const targetIndexes = remaining
        .map((shape, index) => (targetType === 'group' ? shape.groupId === targetId : shape.id === targetId) ? index : -1)
        .filter((index) => index >= 0);
      const insertionIndex = placement === 'before'
        ? Math.max(...targetIndexes) + 1
        : Math.min(...targetIndexes);
      remaining.splice(insertionIndex, 0, { ...layer, groupId: nextGroupId, groupName: nextGroupName });
      const counts = new Map<string, number>();
      remaining.forEach((shape) => {
        if (shape.groupId) counts.set(shape.groupId, (counts.get(shape.groupId) ?? 0) + 1);
      });
      return { ...doc, shapes: remaining.map((shape) => shape.groupId && counts.get(shape.groupId) === 1 ? { ...shape, groupId: undefined, groupName: undefined } : shape) };
    });
  },
  ungroupSelectedLayers: () => {
    const s = get();
    const selected = new Set(s.groupingSelection);
    if (!s.doc.shapes.some((shape) => selected.has(shape.id) && shape.groupId)) return;
    s.act((doc) => {
      const shapes = doc.shapes.map((shape) => selected.has(shape.id) && shape.groupId ? { ...shape, groupId: undefined, groupName: undefined } : shape);
      const counts = new Map<string, number>();
      shapes.forEach((shape) => {
        if (shape.groupId) counts.set(shape.groupId, (counts.get(shape.groupId) ?? 0) + 1);
      });
      return { ...doc, shapes: shapes.map((shape) => shape.groupId && counts.get(shape.groupId) === 1 ? { ...shape, groupId: undefined, groupName: undefined } : shape) };
    });
    set({ groupingSelection: [] });
    get().showToast('Selected layers removed from their groups.');
  },

  setViewport: (w, h) => {
    const s = get();
    if (s.viewport.w === w && s.viewport.h === h) return;
    set({ viewport: { w, h }, ...(s.autoFit ? { view: fitTransform(w, h) } : {}) });
  },
  fitView: () => {
    const { viewport } = get();
    set({ view: fitTransform(viewport.w, viewport.h), autoFit: true });
  },
  zoomAt: (factor, cx, cy) => {
    const { view, viewport } = get();
    const px = cx ?? viewport.w / 2;
    const py = cy ?? viewport.h / 2;
    const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    if (scale === view.scale) return;
    // Keep the map point under (px, py) fixed on screen.
    const ux = (px - view.x) / view.scale;
    const uy = (py - view.y) / view.scale;
    set({ view: { scale, x: px - ux * scale, y: py - uy * scale }, autoFit: false });
  },
  panBy: (dx, dy) => set((s) => ({ view: { ...s.view, x: s.view.x + dx, y: s.view.y + dy }, autoFit: false })),

  checkpoint: () => {
    const s = get();
    if (s.pending === null) set({ pending: snapshot(s.doc) });
  },
  commit: () => {
    const s = get();
    if (s.pending === null) return;
    const changed = !sameContent(s.pending, snapshot(s.doc));
    set({
      pending: null,
      ...(changed ? { past: [...s.past, s.pending].slice(-HISTORY_LIMIT), future: [] } : {}),
    });
  },
  act: (fn) => {
    get().checkpoint();
    set((s) => ({ doc: fn(s.doc) }));
    get().commit();
  },
  liveEdit: (fn) => set((s) => ({ doc: fn(s.doc) })),
  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      past: s.past.slice(0, -1),
      future: [...s.future, snapshot(s.doc)],
      // History restores shapes and background only; the project name is not part of undo.
      doc: { ...s.doc, ...prev },
      pending: null,
      selectedId: findShape(prev.shapes, s.selectedId) ? s.selectedId : null,
      selectedEdgeIndex: null,
    });
  },
  redo: () => {
    const s = get();
    const next = s.future[s.future.length - 1];
    if (!next) return;
    set({
      future: s.future.slice(0, -1),
      past: [...s.past, snapshot(s.doc)].slice(-HISTORY_LIMIT),
      doc: { ...s.doc, ...next },
      pending: null,
      selectedId: findShape(next.shapes, s.selectedId) ? s.selectedId : null,
      selectedEdgeIndex: null,
    });
  },

  setName: (name) => set((s) => ({ doc: { ...s.doc, name: name.slice(0, 60) } })),
  newProject: () => {
    get().act((doc) => ({ ...doc, name: 'Untitled map', shapes: [], background: null }));
    set({ selectedId: null, selectedEdgeIndex: null, draft: null });
    get().showToast('Sheet cleared. Press Ctrl+Z or the undo button to bring it back.');
  },
  openDocument: (next) => {
    get().act((doc) => ({ ...doc, name: next.name, shapes: next.shapes, background: next.background }));
    set({ selectedId: null, selectedEdgeIndex: null, draft: null });
  },
  resetSheetForOfficialMap: (mapName) => {
    get().act((doc) => ({ ...doc, shapes: [], background: null }));
    set({ selectedId: null, selectedEdgeIndex: null, draft: null });
    get().showToast(`Sheet cleared for ${mapName}. Map layouts are not added yet.`);
  },
  addShape: (shape) => {
    get().act((doc) => ({ ...doc, shapes: [...doc.shapes, shape] }));
    set({ selectedId: shape.id, selectedEdgeIndex: null });
  },
  finishPolygon: () => {
    const { draft, kind } = get();
    set({ draft: null });
    if (draft?.type === 'poly' && draft.pts.length >= 3) {
      get().addShape({ id: createId(), type: 'poly', kind, pts: draft.pts });
    }
  },
  removeSelected: () => {
    const id = get().selectedId;
    if (id === null) return;
    get().act((doc) => ({ ...doc, shapes: doc.shapes.filter((s) => s.id !== id) }));
    set({ selectedId: null, selectedEdgeIndex: null });
  },
  reorderSelected: (dir) => {
    const s = get();
    const i = s.doc.shapes.findIndex((o) => o.id === s.selectedId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.doc.shapes.length) return;
    s.act((doc) => {
      const shapes = doc.shapes.slice();
      [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
      return { ...doc, shapes };
    });
  },
  duplicateSelected: () => {
    const s = get();
    const sel = findShape(s.doc.shapes, s.selectedId);
    if (!sel) return;
    const pts = sel.pts.map(([x, y]) => [Math.min(SHEET_SIZE, x + 6), Math.min(SHEET_SIZE, y + 6)] as Point);
    s.addShape({ ...sel, id: createId(), pts });
  },
  nudgeSelected: (dx, dy) => {
    const s = get();
    const selected = findShape(s.doc.shapes, s.selectedId);
    if (!selected) return;
    const members = selected.groupId ? s.doc.shapes.filter((shape) => shape.groupId === selected.groupId) : [selected];
    const ids = new Set(members.map((shape) => shape.id));
    s.act((doc) => ({ ...doc, shapes: doc.shapes.map((shape) => ids.has(shape.id) ? { ...shape, pts: shape.pts.map(([x, y]) => [x + dx, y + dy] as Point) } : shape) }));
  },
  toggleHidden: (id) => {
    get().act((doc) => mapShape(doc, id, (o) => ({ ...o, hidden: o.hidden ? undefined : true })));
  },
  /** Live edit for property fields; the field wraps it in checkpoint()/commit() so typing is one undo step. */
  patchLabel: (id, patch) => {
    get().liveEdit((doc) => mapShape(doc, id, (o) => (o.type === 'label' ? { ...o, ...patch } : o)));
  },
  patchElevation: (id, elevation) => {
    get().liveEdit((doc) => mapShape(doc, id, (o) => (o.type === 'label' || o.type === 'line' || o.type === 'curve' ? o : { ...o, elevation: clamp(elevation, -10, 10) })));
  },
  setSelectedOutlineWidth: (width) => {
    const { selectedId, selectedEdgeIndex } = get();
    if (selectedId === null) return;
    const thickness = clamp(width, 0.25, 8);
    get().act((doc) => mapShape(doc, selectedId, (shape) => {
      if (selectedEdgeIndex === null) return { ...shape, outlineWidth: thickness, edgeWidths: undefined };
      const edgeWidths = [...(shape.edgeWidths ?? [])];
      edgeWidths[selectedEdgeIndex] = thickness;
      return { ...shape, edgeWidths };
    }));
  },
  setSelectedOutline: (outline) => {
    const id = get().selectedId;
    if (id === null) return;
    get().act((doc) => mapShape(doc, id, (o) => ({ ...o, outline, edgeOutlines: undefined })));
  },
  setSelectedEdgeOutline: (outline) => {
    const { selectedId, selectedEdgeIndex } = get();
    if (selectedId === null || selectedEdgeIndex === null) return;
    get().act((doc) => mapShape(doc, selectedId, (o) => {
      const edgeOutlines = [...(o.edgeOutlines ?? [])];
      edgeOutlines[selectedEdgeIndex] = outline;
      return { ...o, edgeOutlines };
    }));
  },
  addErasurePoint: (id, point, startNewStroke) => {
    get().liveEdit((doc) => mapShape(doc, id, (o) => {
      const erasures = (o.erasures ?? []).map((stroke) => stroke.slice());
      const last = erasures[erasures.length - 1];
      const startsStroke = startNewStroke || !last || last.length >= 500;
      if (startsStroke && erasures.length < 500) erasures.push([point]);
      else if (last) {
        const previous = last[last.length - 1];
        if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 0.3 && last.length < 500) last.push(point);
      }
      return { ...o, erasures };
    }));
  },
  addPolygonEdgeGap: (id, edgeIndex, t, previousT) => {
    get().liveEdit((doc) => mapShape(doc, id, (shape) => {
      if ((shape.type !== 'poly' && shape.type !== 'rect') || edgeIndex < 0 || edgeIndex >= shape.pts.length) return shape;
      if ((shape.edgeOutlines?.[edgeIndex] ?? shape.outline) === 'none') return shape;
      const a = shape.pts[edgeIndex];
      const b = shape.pts[(edgeIndex + 1) % shape.pts.length];
      const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (edgeLength < 1e-6) return shape;

      // Make the opening at least brush-width wide and large enough to fully clear thick outlines.
      const outlineWidth = shape.edgeWidths?.[edgeIndex] ?? shape.outlineWidth ?? DEFAULT_OUTLINE_WIDTH;
      const radius = (ERASER_WIDTH + outlineWidth) / (2 * edgeLength);
      const start = clamp(Math.min(t, previousT ?? t) - radius, 0, 1);
      const end = clamp(Math.max(t, previousT ?? t) + radius, 0, 1);
      const edgeGaps = (shape.edgeGaps ?? []).map((gaps) => gaps.map(([lo, hi]) => [lo, hi] as EdgeGap));
      const intervals = [...(edgeGaps[edgeIndex] ?? []), [start, end] as EdgeGap].sort((left, right) => left[0] - right[0]);
      const merged: EdgeGap[] = [];
      for (const interval of intervals) {
        const last = merged[merged.length - 1];
        if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
        else merged.push([interval[0], interval[1]]);
      }
      edgeGaps[edgeIndex] = merged;
      return { ...shape, edgeGaps };
    }));
  },
  finalizePolygonEdgeGaps: (id) => {
    const current = findShape(get().doc.shapes, id);
    if (!current || (current.type !== 'poly' && current.type !== 'rect') || !current.edgeGaps?.some((gaps) => gaps.length)) return;
    get().liveEdit((doc) => mapShape(doc, id, (shape) => {
      if ((shape.type !== 'poly' && shape.type !== 'rect') || !shape.edgeGaps?.some((gaps) => gaps.length)) return shape;
      const pts: Point[] = [shape.pts[0]];
      const edgeOutlines: EdgeOutline[] = [];
      const edgeWidths: number[] = [];
      const lastOriginalEdge = shape.pts.length - 1;

      for (let i = 0; i < shape.pts.length; i++) {
        const a = shape.pts[i];
        const b = shape.pts[(i + 1) % shape.pts.length];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const outline = shape.edgeOutlines?.[i] ?? shape.outline;
        const width = shape.edgeWidths?.[i] ?? shape.outlineWidth ?? DEFAULT_OUTLINE_WIDTH;
        const intervals = (shape.edgeGaps[i] ?? []).slice().sort((left, right) => left[0] - right[0]);
        const append = (t: number, segmentOutline: Outline | undefined) => {
          edgeOutlines.push(segmentOutline);
          edgeWidths.push(width);
          const endpoint: Point = [a[0] + dx * t, a[1] + dy * t];
          // Do not duplicate the first point at the end; the polygon closes back to it.
          if (i !== lastOriginalEdge || t < 1 - 1e-5) pts.push(endpoint);
        };

        let cursor = 0;
        for (const [start, end] of intervals) {
          const lo = clamp(start, cursor, 1);
          const hi = clamp(end, lo, 1);
          if (lo > cursor + 1e-5) append(lo, outline);
          if (hi > lo + 1e-5) append(hi, 'none');
          cursor = Math.max(cursor, hi);
        }
        if (cursor < 1 - 1e-5) append(1, outline);
      }

      return {
        ...shape,
        type: 'poly',
        pts,
        edgeOutlines,
        edgeWidths,
        edgeGaps: undefined,
      };
    }));
  },
  setBackground: (bg) => get().act((doc) => ({ ...doc, background: bg })),
  patchBackground: (patch) => {
    get().liveEdit((doc) => (doc.background ? { ...doc, background: { ...doc.background, ...patch } } : doc));
  },
}));
