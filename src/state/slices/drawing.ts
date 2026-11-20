import type { StateCreator } from 'zustand';
import type { EditorState } from '../../stores/editorStore';
import { findShape, mapShape } from '../editorStoreHelpers';
import { clamp } from '../../lib/geometry';
import { createId } from '../../lib/id';
import { DEFAULT_OUTLINE_WIDTH, ERASER_WIDTH } from '../../types/map';
import type { EdgeGap, EdgeOutline, Outline, Point } from '../../types/map';

type Slice = Pick<EditorState, 'setTool' | 'setKind' | 'setAlt' | 'setSpaceHeld' | 'setCursor' | 'setDraft' | 'setEraserMode' | 'finishPolygon' | 'addErasurePoint' | 'addCutoutPoints' | 'addPolygonEdgeGap' | 'finalizePolygonEdgeGaps'>;
export const createDrawingSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
  setTool: (tool) => set({ tool, draft: null, selectionBox: null, marqueeSelection: [], hoverTarget: null }),
  setKind: (kind) => {
    const s = get();
    const sel = findShape(s.doc.shapes, s.selectedId);
    set({ kind });
    if (sel && s.tool === 'select') {
      if (kind === 'cut' && (sel.type === 'poly' || sel.type === 'rect' || sel.type === 'circle')) {
        s.cutoutArea(sel, sel.id);
      } else if (kind !== 'cut' && sel.type !== 'label') {
        s.act((doc) => mapShape(doc, sel.id, (o) => (o.type === 'label' ? o : { ...o, kind })));
      }
    }
  },
  setAlt: (altKey) => {
    if (get().altKey !== altKey) set({ altKey });
  },
  setSpaceHeld: (spaceHeld) => {
    if (get().spaceHeld !== spaceHeld) set({ spaceHeld });
  },
  setCursor: (cursor, rawCursor) => set({ cursor, rawCursor }),
  setDraft: (draft) => set({ draft }),
  setEraserMode: (eraserMode) => set({ eraserMode }),
  finishPolygon: () => {
    const { draft, kind } = get();
    set({ draft: null });
    if (draft?.type === 'poly' && draft.pts.length >= 3) {
      const shape = { id: createId(), type: 'poly' as const, kind, pts: draft.pts };
      if (kind === 'cut') get().cutoutArea(shape);
      else get().addShape(shape);
    }
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
  addCutoutPoints: (updates) => {
    if (!updates.length) return;
    get().liveEdit((doc) => {
      const cutoutsById = new Map<string, Point[][]>();
      for (const { id, point, startNewStroke } of updates) {
        const shape = doc.shapes.find((item) => item.id === id);
        if (!shape) continue;
        const cutouts = cutoutsById.get(id) ?? (shape.cutouts ?? []).map((stroke) => stroke.map(([x, y]) => [x, y] as Point));
        const last = cutouts[cutouts.length - 1];
        if (startNewStroke || !last || last.length >= 500) {
          if (cutouts.length < 500) cutouts.push([point]);
        } else if (Math.hypot(point[0] - last[last.length - 1][0], point[1] - last[last.length - 1][1]) >= 0.3 && last.length < 500) {
          last.push(point);
        }
        cutoutsById.set(id, cutouts);
      }
      return { ...doc, shapes: doc.shapes.map((shape) => cutoutsById.has(shape.id) ? { ...shape, cutouts: cutoutsById.get(shape.id) } : shape) };
    });
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
  }
});
