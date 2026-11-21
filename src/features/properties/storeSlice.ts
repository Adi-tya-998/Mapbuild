import type { StateCreator } from 'zustand';
import type { EditorState } from '../../state/editorStoreTypes';
import { mapShape } from '../../state/editorStoreHelpers';
import { clamp } from '../../lib/geometry';

type Slice = Pick<EditorState, 'patchLabel' | 'patchElevation' | 'setSelectedOutlineWidth' | 'setSelectedOutline' | 'setSelectedEdgeOutline' | 'setBackground' | 'patchBackground'>;
export const createPropertiesSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
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
  setBackground: (bg) => get().act((doc) => ({ ...doc, background: bg })),
  patchBackground: (patch) => {
    get().liveEdit((doc) => (doc.background ? { ...doc, background: { ...doc.background, ...patch } } : doc));
  }
});
