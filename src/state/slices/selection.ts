import type { StateCreator } from 'zustand';
import type { EditorState } from '../../stores/editorStore';
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon } from 'polygon-clipping';
import { closedRing, findShape, geometryShapes, mapShape } from '../editorStoreHelpers';
import { createId } from '../../lib/id';
import { SHEET_SIZE } from '../../types/map';
import type { EdgeGap, MapObject, Point } from '../../types/map';

type Slice = Pick<EditorState, 'select' | 'setMarqueeSelection' | 'setSelectionBox' | 'selectEdge' | 'setHoverTarget' | 'addPolygonVertex' | 'detachPolygonsInBox' | 'removeSelected' | 'reorderSelected' | 'duplicateSelected' | 'nudgeSelected'>;
export const createSelectionSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
  select: (selectedId) => set({ selectedId, selectedEdgeIndex: null, marqueeSelection: [] }),
  setMarqueeSelection: (marqueeSelection) => set({ marqueeSelection, selectedId: null, selectedEdgeIndex: null }),
  setSelectionBox: (selectionBox) => set({ selectionBox }),
  selectEdge: (selectedEdgeIndex) => set({ selectedEdgeIndex }),
  setHoverTarget: (hoverTarget) => set((s) => {
    const current = s.hoverTarget;
    if (current?.shapeId === hoverTarget?.shapeId && current?.part === hoverTarget?.part && current?.index === hoverTarget?.index && current?.ring === hoverTarget?.ring) return s;
    return { hoverTarget };
  }),
  addPolygonVertex: (id, edgeIndex, t, point) => {
    get().act((doc) => mapShape(doc, id, (shape) => {
      if ((shape.type !== 'poly' && shape.type !== 'rect') || edgeIndex < 0 || edgeIndex >= shape.pts.length || t <= 0 || t >= 1) return shape;
      const pts = shape.pts.slice();
      pts.splice(edgeIndex + 1, 0, point);

      const splitEdgeValues = <T,>(values: T[] | undefined): T[] | undefined =>
        values ? [...values.slice(0, edgeIndex + 1), values[edgeIndex], ...values.slice(edgeIndex + 1)] : undefined;

      let edgeGaps = shape.edgeGaps?.map((gaps) => gaps.map(([start, end]) => [start, end] as EdgeGap));
      if (edgeGaps) {
        const original = edgeGaps[edgeIndex] ?? [];
        const left = original.flatMap(([start, end]) => start < t ? [[start / t, Math.min(end, t) / t] as EdgeGap] : []);
        const right = original.flatMap(([start, end]) => end > t
          ? [[(Math.max(start, t) - t) / (1 - t), (end - t) / (1 - t)] as EdgeGap]
          : []);
        edgeGaps = [...edgeGaps.slice(0, edgeIndex), left, right, ...edgeGaps.slice(edgeIndex + 1)];
      }

      return {
        ...shape,
        type: 'poly',
        pts,
        edgeOutlines: splitEdgeValues(shape.edgeOutlines),
        edgeWidths: splitEdgeValues(shape.edgeWidths),
        edgeGaps,
      };
    }));
    set({ selectedId: id, selectedEdgeIndex: null });
    get().showToast('Point added. Select the shape and drag its new vertex to edit it.');
  },
  detachPolygonsInBox: (a, b) => {
    const s = get();
    const x0 = Math.min(a[0], b[0]);
    const x1 = Math.max(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]);
    const y1 = Math.max(a[1], b[1]);
    if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return;
    const box: MultiPolygon = [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]];
    const detachedGroupId = createId();
    const nextShapes: MapObject[] = [];
    const affectedIds: string[] = [];
    let detachedPieces = 0;
    for (const shape of s.doc.shapes) {
      if (shape.hidden || (shape.type !== 'poly' && shape.type !== 'rect')) {
        nextShapes.push(shape);
        continue;
      }
      const sourceGeometry: MultiPolygon = [[closedRing(shape.pts), ...(shape.holes ?? []).map(closedRing)]];
      const intersection = polygonClipping.intersection(sourceGeometry, box);
      if (!intersection.length) {
        nextShapes.push(shape);
        continue;
      }
      const difference = polygonClipping.difference(sourceGeometry, box);
      const sourceParts = geometryShapes(shape, difference, false, undefined);
      const extractedParts = geometryShapes(shape, intersection, true, detachedGroupId);
      nextShapes.push(...sourceParts, ...extractedParts);
      affectedIds.push(...sourceParts.map((part) => part.id), ...extractedParts.map((part) => part.id));
      detachedPieces += extractedParts.length;
    }
    if (!detachedPieces) {
      s.showToast('The selection box did not cover any polygon area.');
      return;
    }
    s.act((doc) => ({ ...doc, shapes: nextShapes }));
    get().setMarqueeSelection(affectedIds);
    get().showToast(`Detached ${detachedPieces} polygon piece${detachedPieces === 1 ? '' : 's'}. Blue points edit each new vertex.`);
  },
  removeSelected: () => {
    const { selectedId, marqueeSelection } = get();
    const ids = new Set([...marqueeSelection, ...(selectedId ? [selectedId] : [])]);
    if (ids.size === 0) return;
    get().act((doc) => ({ ...doc, shapes: doc.shapes.filter((shape) => !ids.has(shape.id)) }));
    set({ selectedId: null, selectedEdgeIndex: null, marqueeSelection: [], selectionBox: null });
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
    const offsetStrokes = (strokes: Point[][] | undefined) => strokes?.map((stroke) => stroke.map(([x, y]) => [Math.min(SHEET_SIZE, x + 6), Math.min(SHEET_SIZE, y + 6)] as Point));
    s.addShape({ ...sel, id: createId(), pts, holes: offsetStrokes(sel.holes), erasures: offsetStrokes(sel.erasures), cutouts: offsetStrokes(sel.cutouts) });
  },
  nudgeSelected: (dx, dy) => {
    const s = get();
    const selected = findShape(s.doc.shapes, s.selectedId);
    if (!selected) return;
    const members = selected.groupId ? s.doc.shapes.filter((shape) => shape.groupId === selected.groupId) : [selected];
    const ids = new Set(members.map((shape) => shape.id));
    s.act((doc) => ({ ...doc, shapes: doc.shapes.map((shape) => ids.has(shape.id) ? {
      ...shape,
      pts: shape.pts.map(([x, y]) => [x + dx, y + dy] as Point),
      ...(shape.holes ? { holes: shape.holes.map((ring) => ring.map(([x, y]) => [x + dx, y + dy] as Point)) } : {}),
      ...(shape.erasures ? { erasures: shape.erasures.map((stroke) => stroke.map(([x, y]) => [x + dx, y + dy] as Point)) } : {}),
      ...(shape.cutouts ? { cutouts: shape.cutouts.map((stroke) => stroke.map(([x, y]) => [x + dx, y + dy] as Point)) } : {}),
    } : shape) }));
  }
});
