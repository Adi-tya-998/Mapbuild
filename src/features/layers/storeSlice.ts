import type { StateCreator } from 'zustand';
import type { EditorState } from '../../state/editorStoreTypes';
import { mapShape } from '../../state/editorStoreHelpers';
import { createId } from '../../lib/id';

type Slice = Pick<EditorState, 'toggleGroupingSelection' | 'groupSelectedLayers' | 'addLayerToGroup' | 'renameLayer' | 'renameGroup' | 'reorderGroup' | 'reorderLayer' | 'ungroupSelectedLayers' | 'toggleHidden'>;
export const createLayersSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
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
  toggleHidden: (id) => {
    get().act((doc) => mapShape(doc, id, (o) => ({ ...o, hidden: o.hidden ? undefined : true })));
  }
});
