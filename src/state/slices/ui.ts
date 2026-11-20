import type { StateCreator } from 'zustand';
import type { EditorState } from '../../stores/editorStore';
import { loadTheme } from '../../lib/storage';

type Slice = Pick<EditorState, 'showToast' | 'clearToast' | 'setTheme' | 'toggleGrid' | 'toggleSnap' | 'setGridSize'>;
export const createUiSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
  showToast: (message) => set({ toast: { id: Date.now() + Math.random(), message } }),
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : {})),
  setTheme: (theme) => set({ theme }),
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setGridSize: (gridSize) => set({ gridSize })
});
