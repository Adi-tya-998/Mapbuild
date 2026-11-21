import type { StateCreator } from 'zustand';
import type { EditorState } from '../../state/editorStoreTypes';
import { bakeLegacyCutoutLayers, filledGeometry, findShape, sameContent, snapshot, subtractCutout } from '../../state/editorStoreHelpers';
import { createId } from '../../lib/id';
import type { MapObject } from '../../types/map';

const HISTORY_LIMIT = 150;

type Slice = Pick<EditorState, 'hydrate' | 'checkpoint' | 'commit' | 'act' | 'liveEdit' | 'undo' | 'redo' | 'setName' | 'newProject' | 'openDocument' | 'resetSheetForOfficialMap' | 'addShape' | 'cutoutArea'>;
export const createDocumentSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
  hydrate: (doc) => set({ doc: { ...doc, shapes: bakeLegacyCutoutLayers(doc.shapes) }, status: 'ready', past: [], future: [], pending: null, selectedId: null, selectedEdgeIndex: null, groupingSelection: [], draft: null }),
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
    const shapes = bakeLegacyCutoutLayers(next.shapes);
    get().act((doc) => ({ ...doc, name: next.name, shapes, background: next.background }));
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
  cutoutArea: (cutter, beforeShapeId) => {
    const s = get();
    const cutterIndex = beforeShapeId ? s.doc.shapes.findIndex((shape) => shape.id === beforeShapeId) : s.doc.shapes.length;
    if (beforeShapeId && cutterIndex < 0) return;
    const geometry = filledGeometry(cutter);
    let changed = false;
    s.act((doc) => {
      const shapes: MapObject[] = [];
      doc.shapes.forEach((shape, index) => {
        if (shape.id === beforeShapeId) return;
        if (index < cutterIndex) {
          const result = subtractCutout(shape, geometry);
          changed ||= result.changed;
          shapes.push(...result.pieces);
        } else {
          shapes.push(shape);
        }
      });
      return { ...doc, shapes };
    });
    set({ selectedId: null, selectedEdgeIndex: null, marqueeSelection: [] });
    get().showToast(changed ? 'Cutout applied directly to the map. Press Ctrl+Z to undo.' : 'The cutout did not overlap any filled map areas.');
  }
});
