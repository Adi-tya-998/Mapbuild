import type { StateCreator } from 'zustand';
import type { EditorState } from '../../state/editorStoreTypes';
import { clamp, fitTransform } from '../../lib/geometry';
import { MAX_SCALE, MIN_SCALE } from './constants';

type Slice = Pick<EditorState, 'setViewport' | 'fitView' | 'zoomAt' | 'panBy' | 'toggleGrid' | 'toggleSnap' | 'setGridSize'>;
export const createCanvasSlice: StateCreator<EditorState, [], [], Slice> = (set, get) => ({
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
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setGridSize: (gridSize) => set({ gridSize })
});
