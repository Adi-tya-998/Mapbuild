import { create } from 'zustand';
import type { EditorState } from '../state/editorStoreTypes';
export type { EditorState, HoverTarget, ViewState, Viewport, LabelPatch } from '../state/editorStoreTypes';
import { createDocumentSlice } from '../features/projects/storeSlice';
import { createSelectionSlice } from '../features/selection/storeSlice';
import { createDrawingSlice } from '../features/drawing/storeSlice';
import { createEraserSlice } from '../features/eraser/storeSlice';
import { createCanvasSlice } from '../features/canvas/storeSlice';
import { createLayersSlice } from '../features/layers/storeSlice';
import { createPropertiesSlice } from '../features/properties/storeSlice';
import { createUiSlice } from '../shared/storeSlice';
import { fitTransform } from '../lib/geometry';
import { emptyDocument } from '../lib/emptyDocument';
import { loadTheme } from '../lib/storage';

export { MIN_SCALE, MAX_SCALE } from '../lib/editorInteraction';

export { findShape, mapShape, snapshot, closedRing, geometryShapes, filledGeometry, subtractCutout, bakeLegacyCutoutLayers, sameContent } from '../state/editorStoreHelpers';

const initialView = fitTransform(600, 600);

export const useEditorStore = create<EditorState>()((set, get, api) => ({
  status: 'loading',
  doc: emptyDocument(),
  selectedId: null,
  selectedEdgeIndex: null,
  hoverTarget: null,
  marqueeSelection: [],
  selectionBox: null,
  eraserMode: 'area',
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
  ...createDocumentSlice(set, get, api),
  ...createSelectionSlice(set, get, api),
  ...createDrawingSlice(set, get, api),
  ...createEraserSlice(set, get, api),
  ...createCanvasSlice(set, get, api),
  ...createLayersSlice(set, get, api),
  ...createPropertiesSlice(set, get, api),
  ...createUiSlice(set, get, api),
}));
