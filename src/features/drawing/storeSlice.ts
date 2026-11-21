import type { StateCreator } from 'zustand';
import type { EditorState } from '../../state/editorStoreTypes';
import { findShape, mapShape } from '../../state/editorStoreHelpers';
import { createId } from '../../lib/id';

type Slice = Pick<EditorState, 'setTool' | 'setKind' | 'setAlt' | 'setSpaceHeld' | 'setCursor' | 'setDraft' | 'finishPolygon'>;
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
  finishPolygon: () => {
    const { draft, kind } = get();
    set({ draft: null });
    if (draft?.type === 'poly' && draft.pts.length >= 3) {
      const shape = { id: createId(), type: 'poly' as const, kind, pts: draft.pts };
      if (kind === 'cut') get().cutoutArea(shape);
      else get().addShape(shape);
    }
  }
});
