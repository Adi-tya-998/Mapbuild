# Architecture

This document records the feature boundaries and store composition in the code today. Feature dependencies below name imports between feature folders; shared types, helpers, and browser libraries are described separately.

## Application composition

- **Purpose:** Start React, restore the local project, and arrange the editor interface.
- **Owned files:** `src/main.tsx`, `src/App.tsx`.
- **Public API:** The application entry is `src/main.tsx`; it is not a feature barrel.
- **State slice:** None. The application composes the editor store and feature interfaces.
- **Feature imports:** Canvas, drawing, eraser, export, layers, projects, properties, selection, shared, and toolbar are used by the composed interface. Thin compatibility aliases still bridge some application imports; cleanup is planned in Step 3.
- **Behaviors to preserve:** Initial project hydration, autosave startup, theme setup, and editor layout.

## Canvas

- **Purpose:** Render the map sheet and own viewport, grid, snapping, coordinate conversion, and the shared pointer lifecycle.
- **Owned files:** `src/features/canvas/CanvasNodes.tsx`, `src/features/canvas/storeSlice.ts`, `src/features/canvas/useCanvasInteractions.ts`.
- **Public API (`src/features/canvas/index.ts`):** `BackgroundImage`, `EditorOverlay`, `GridLines`, `SheetShapes`, `SELECTION_COLOR`, `useCanvasInteractions`, type `Drag`, `createCanvasSlice`, `MIN_SCALE`, `MAX_SCALE`.
- **State slice:** `createCanvasSlice` in `storeSlice.ts`; owns viewport, zoom, pan, grid visibility, snapping, and grid size.
- **Feature imports:** Drawing, eraser, and selection. Canvas calls their handlers from the shared pointer lifecycle and uses selection rendering. The other features do not import canvas; shared interaction types and zoom limits are in `src/lib/editorInteraction.ts`.
- **Behaviors to preserve:** Map-unit coordinates, centered and cursor-anchored zoom, pan, grid alignment/density, snapping, pointer capture, and rendering order.

## Drawing

- **Purpose:** Define available tools and create map shapes and boundary lines/curves.
- **Owned files:** `src/features/drawing/tools.ts`, `src/features/drawing/handlers/shapeDrawing.ts`, `src/features/drawing/storeSlice.ts`.
- **Public API (`src/features/drawing/index.ts`):** `TOOLS`, `TOOL_BY_KEY`, `beginShapeDrawing`, `finishShapeDraft`, `moveShapeDraft`, `createDrawingSlice`.
- **State slice:** `createDrawingSlice` in `storeSlice.ts`; owns the active tool, surface kind, modifier/cursor state, draft shape, and polygon completion.
- **Feature imports:** None.
- **Behaviors to preserve:** Tool shortcuts, grid and Alt snapping, polygon completion/cancel behavior, line and curve creation, surface kinds, and undo grouping.

## Eraser

- **Purpose:** Erase swept map areas and open polygon boundaries.
- **Owned files:** `src/features/eraser/handlers/eraser.ts`, `src/features/eraser/storeSlice.ts`.
- **Public API (`src/features/eraser/index.ts`):** `beginEraser`, `finishBoundaryEraser`, `moveEraser`, `createEraserSlice`.
- **State slice:** `createEraserSlice` in `storeSlice.ts`; owns eraser mode, area strokes, cutout subtraction, and polygon edge gaps.
- **Feature imports:** None. Eraser handlers import the shared `Drag` type from `src/lib/editorInteraction.ts`.
- **Behaviors to preserve:** Normal drag erases only the path crossed; modifier boundary erasure; edge-only mode creates a true gap with separate endpoints; undo treats a completed gesture as one action.

## Selection

- **Purpose:** Select and edit shapes, edges, and vertices; box-select and detach polygon areas.
- **Owned files:** `src/features/selection/SelectionOverlay.tsx`, `src/features/selection/storeSlice.ts`, `src/features/selection/handlers/point.ts`, `src/features/selection/handlers/select.ts`.
- **Public API (`src/features/selection/index.ts`):** `SelectionOverlay`, type `SelectionOverlayProps`, `beginSelectTool`, `selectHoverTargetAt`, `selectionBoxIntersects`, `updateSelectDrag`, `handlePointTool`, `nearestPolygonEdge`, `POINT_HIT_PX`, `createSelectionSlice`.
- **State slice:** `createSelectionSlice` in `storeSlice.ts`; owns selected shape/edge, hover target, marquee, and selection box.
- **Feature imports:** None. Selection handlers import the shared `Drag` type from `src/lib/editorInteraction.ts`.
- **Behaviors to preserve:** Move, resize, rotate, hover highlight, Alt vertex dragging, point insertion, box selection, detach, editable detached vertices, and selection cleanup after undo/redo.

## Layers

- **Purpose:** Display and manage map layers and groups.
- **Owned files:** `src/features/layers/LayersPanel.tsx`, `src/features/layers/storeSlice.ts`.
- **Public API (`src/features/layers/index.ts`):** `LayersPanel`, `layerNames`, `createLayersSlice`.
- **State slice:** `createLayersSlice` in `storeSlice.ts`; owns group membership, names, order, visibility, and grouping selection.
- **Feature imports:** None.
- **Behaviors to preserve:** Stable back-to-front document order, front-to-back panel order, independent ungrouping, adding one layer to a group, reordering across group boundaries, and group movement.

## Properties

- **Purpose:** Edit surface settings, elevation, outlines, labels, and background properties.
- **Owned files:** `src/features/properties/PropertiesPanel.tsx`, `src/features/properties/storeSlice.ts`.
- **Public API (`src/features/properties/index.ts`):** `PropertiesPanel`, `createPropertiesSlice`.
- **State slice:** `createPropertiesSlice` in `storeSlice.ts`; owns surface/elevation/outline/label/background mutations.
- **Feature imports:** Projects, for background image import.
- **Behaviors to preserve:** Per-edge outline changes affect only the selected edge, width presets, elevation shading, undo semantics, and background import.

## Toolbar

- **Purpose:** Provide tool selection, project/map controls, grid/snap/zoom controls, history, status, and keyboard shortcuts.
- **Owned files:** `src/features/toolbar/EditorToolbar.tsx`, `src/features/toolbar/ToolRail.tsx`, `src/features/toolbar/StatusBar.tsx`, `src/features/toolbar/useEditorShortcuts.ts`.
- **Public API (`src/features/toolbar/index.ts`):** `EditorToolbar`, `ToolRail`, `StatusBar`, `useEditorShortcuts`.
- **State slice:** None. Toolbar actions call drawing, canvas, project/history, and shared UI state.
- **Feature imports:** Drawing and projects.
- **Behaviors to preserve:** Tool shortcuts, map name editing, official-map reset, grid/snap controls, undo/redo, theme selection, and status hints.

## Export

- **Purpose:** Render and download the current map as a transparent PNG.
- **Owned files:** `src/features/export/ExportDialog.tsx`, `src/features/export/exportPng.ts`.
- **Public API (`src/features/export/index.ts`):** `ExportDialog`, `paintSheet`, `renderPng`.
- **State slice:** None. Export reads the current document.
- **Feature imports:** None.
- **Behaviors to preserve:** Transparent background, map-only output, shape/outline/elevation fidelity, hidden-object behavior, and export sizing/cancellation.

## Projects

- **Purpose:** Create, validate, open, save, import, autosave, and restore local map documents.
- **Owned files:** `src/features/projects/projectIO.ts`, `src/features/projects/sampleProject.ts`, `src/features/projects/storeSlice.ts`.
- **Public API (`src/features/projects/index.ts`):** `importBackgroundImage`, `handleDroppedFile`, `openProjectFile`, `saveProjectFile`, `sampleDocument`, `emptyDocument`, `createDocumentSlice`.
- **State slice:** `createDocumentSlice` in `storeSlice.ts`; owns project hydration, document edits, and undo/redo history.
- **Feature imports:** None. Project I/O uses the central editor store directly.
- **Behaviors to preserve:** Versioned JSON compatibility, import validation, autosave restore, empty-document initialization, image backgrounds, and legacy cutout migration.

## Shared

- **Purpose:** Provide reusable interface and transient UI state used across the editor.
- **Owned files:** `src/shared/Toast.tsx`, `src/shared/storeSlice.ts`.
- **Public API (`src/shared/index.ts`):** `Toast`, `createUiSlice`.
- **State slice:** `createUiSlice` in `storeSlice.ts`; owns toast and theme state.
- **Feature imports:** None. Toast reads the central editor store.
- **Behaviors to preserve:** Toast lifecycle and browser theme persistence.

## Central state and helpers

- `src/stores/editorStore.ts` composes feature slices. It imports slice modules directly to avoid loading feature UI barrels and creating a runtime initialization cycle.
- `src/state/editorStoreTypes.ts` defines the shared Zustand contract used by the slices and store.
- `src/state/editorStoreHelpers.ts` contains pure document and geometry helpers used across slices. These remain central because moving them into one feature would make other features depend on that feature and could reintroduce cycles.
- `src/lib/editorInteraction.ts` defines the `Drag` union and zoom scale limits shared by canvas and the tool handlers.
- `src/types/` contains map and project data types. `src/lib/` contains shared geometry, validation, persistence, export, image, and download utilities.

## Import rules

- Feature-to-feature imports go through the owning feature's `index.ts`.
- The central store composer may import a feature's `storeSlice.ts` directly to avoid runtime cycles.
- Shared code does not import features, and features do not import application composition.
- Feature dependency cycles are prohibited. `scripts/check-import-boundaries.mjs` enforces these rules.
