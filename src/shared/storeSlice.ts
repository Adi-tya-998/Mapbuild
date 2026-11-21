import type { StateCreator } from 'zustand';
import type { EditorState } from '../state/editorStoreTypes';

type Slice = Pick<EditorState, 'showToast' | 'clearToast' | 'setTheme'>;
export const createUiSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
  showToast: (message) => set({ toast: { id: Date.now() + Math.random(), message } }),
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : {})),
  setTheme: (theme) => set({ theme })
});
