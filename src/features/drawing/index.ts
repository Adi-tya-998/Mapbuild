export { TOOLS, TOOL_BY_KEY } from './tools';
export { beginShapeDrawing, finishShapeDraft, moveShapeDraft } from './handlers/shapeDrawing';
export { createDrawingSlice } from './storeSlice';
// Compatibility facade for existing app imports; feature-specific code should use canvas/index.ts.
export { BackgroundImage, EditorOverlay, GridLines, SheetShapes, useCanvasInteractions } from '../canvas';
