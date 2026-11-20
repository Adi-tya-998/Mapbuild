# Feature architecture

This document describes the target feature boundaries for the refactor. The drawing and projects feature indexes exist today. Selection, eraser, canvas, layers, properties, toolbar, export, and shared are planned ownership boundaries; their files and APIs are still being split in later steps. Until those steps are complete, paths below marked **current** remain in their existing location.

Cross-feature dependencies use the owning feature's `index.ts`. The shared area must not import from a feature, and features must not import from the app composition layer. Shared domain types may live in `src/types/`.

## App composition

- **Purpose:** Assemble the application shell, feature panels, and shared UI.
- **Owned files:** `src/App.tsx`, `src/main.tsx` (current).
- **Public API:** No feature `index.ts`; app entry is `src/main.tsx`.
- **State slice:** None; the app composes feature APIs and store hooks.
- **Depends on:** Toolbar, canvas, layers, properties, export, projects, shared.
- **Must not regress:** Startup hydration, autosave startup, theme setup, and app layout.

## Drawing

- **Purpose:** Define draw tools and create filled shapes and boundary lines/curves.
- **Owned files:** Target: tool definitions and shape-creation handlers under `src/features/drawing/`. Current: `src/features/drawing/tools.ts`, `handlers/shapeDrawing.ts`, and drawing portions of `useCanvasInteractions.ts`.
- **Public API:** `src/features/drawing/index.ts`; currently exports `TOOLS`, `TOOL_BY_KEY`, and `useCanvasInteractions` alongside rendering exports. Target: drawing tool metadata and creation-handler entry points.
- **State slice:** `drawing` slice for active tool, surface kind, modifiers, and draft; creation actions such as `finishPolygon`. Current: `src/state/slices/drawing.ts`.
- **Depends on:** Shared map types and geometry helpers; canvas for the pointer lifecycle through its public API.
- **Must not regress:** Tool shortcuts, grid/Alt snapping behavior, polygon completion/cancel behavior, line and curve creation, shape kinds, and undo step grouping.

## Selection

- **Purpose:** Select and edit objects, vertices, and edges; box-select and detach polygon areas.
- **Owned files:** Target: selection handlers and selection/handle rendering under `src/features/selection/`. Current: `src/features/drawing/handlers/select.ts`, selection portions of `CanvasNodes.tsx` and `useCanvasInteractions.ts`.
- **Public API:** Target `src/features/selection/index.ts` exports selection handlers and selection overlays. This entry point does not exist yet.
- **State slice:** `selection` slice owns selected object/edge, hover target, marquee and selection box. Current: `src/state/slices/selection.ts`.
- **Depends on:** Shared map types and geometry; canvas pointer lifecycle; drawing render composition through public APIs.
- **Must not regress:** Move, resize, rotate, Alt vertex dragging, insert/remove points, Ctrl+right-drag box selection, Ctrl+left-drag detach, editable detached vertices, and selection cleanup after undo/redo.

## Eraser

- **Purpose:** Erase swept surface areas and create openings in polygon boundaries.
- **Owned files:** Target: eraser handlers and eraser-only visual helpers under `src/features/eraser/`. Current: `src/features/drawing/handlers/eraser.ts`, eraser portions of `useCanvasInteractions.ts`, and eraser actions in `src/state/slices/drawing.ts`.
- **Public API:** Target `src/features/eraser/index.ts` exports area and edge-erasing handlers. This entry point does not exist yet.
- **State slice:** Target eraser slice owns eraser mode and outline-erasure actions; currently those actions share `src/state/slices/drawing.ts`.
- **Depends on:** Shared geometry/map types and canvas pointer lifecycle.
- **Must not regress:** Left-drag erases only the swept area; Ctrl+left-drag boundary erasure; edge-only mode creates a true opening with independent vertices; undo commits a completed stroke correctly.

## Canvas

- **Purpose:** Own viewport, grid, snap, coordinate conversion, shared pointer lifecycle, and map rendering.
- **Owned files:** Target: `src/features/canvas/` including canvas stage, grid and sheet/object renderers. Current: `src/components/MapCanvas.tsx`, `src/features/drawing/CanvasNodes.tsx`, and shared lifecycle in `src/features/drawing/useCanvasInteractions.ts`.
- **Public API:** Target `src/features/canvas/index.ts` exports the stage, grid/sheet renderers, and interaction hook. This entry point does not exist yet.
- **State slice:** `canvas` slice owns view, viewport, zoom, pan, grid, snap, and grid size. Current: `src/state/slices/canvas.ts`; grid/snap toggles currently live in `src/state/slices/ui.ts`.
- **Depends on:** Drawing, selection, and eraser public APIs; shared types and geometry; projects for document/background data.
- **Must not regress:** Map-unit coordinates, centered and cursor-anchored zoom behavior, pan, grid alignment/density, snapping, pointer capture, and object render order.

## Layers

- **Purpose:** Show, select, hide, group, rename, and reorder map objects.
- **Owned files:** Target: `src/features/layers/`; current UI is `src/components/LayersPanel.tsx`, state is in `src/state/slices/layers.ts`.
- **Public API:** Target `src/features/layers/index.ts` exports the layers panel and layer/group helpers. This entry point does not exist yet.
- **State slice:** Layers slice owns group selection, group membership, names, order, and visibility.
- **Depends on:** Shared map types; selection and canvas APIs for selection/order behavior.
- **Must not regress:** Stable back-to-front document order, front-to-back panel order, independent ungrouping, single-layer group addition, free reorder across group boundaries, and group movement.

## Properties

- **Purpose:** Edit selected surfaces, elevation, edge outlines/widths, labels, and background settings.
- **Owned files:** Target: `src/features/properties/`; current UI is `src/components/PropertiesPanel.tsx`, state is in `src/state/slices/properties.ts`.
- **Public API:** Target `src/features/properties/index.ts` exports the properties panel. This entry point does not exist yet.
- **State slice:** Properties slice owns surface/elevation/outline/label/background mutations.
- **Depends on:** Shared map/project types, selection, and projects for background import.
- **Must not regress:** Per-edge style changes affect only the selected edge, width presets, elevation shading, undo semantics, and background import behavior.

## Toolbar

- **Purpose:** Provide tool selection, map/project controls, grid/snap/zoom controls, history controls, status and keyboard shortcuts.
- **Owned files:** Target: `src/features/toolbar/`; current: `src/components/EditorToolbar.tsx`, `ToolRail.tsx`, `StatusBar.tsx`, and `src/hooks/useEditorShortcuts.ts`.
- **Public API:** Target `src/features/toolbar/index.ts` exports toolbar, tool rail, status bar, and shortcut hook. This entry point does not exist yet.
- **State slice:** No standalone toolbar slice; toolbar controls call drawing, canvas, project/history, and shared UI slices.
- **Depends on:** Drawing, canvas, projects, export, and shared APIs.
- **Must not regress:** Existing shortcut keys, map name editing, blank official-map reset behavior, grid/snap settings, undo/redo, theme selection, and status hints.

## Export

- **Purpose:** Export the current map as a transparent PNG.
- **Owned files:** Target: `src/features/export/`; current UI is `src/components/ExportDialog.tsx` and painter is `src/lib/exportPng.ts`.
- **Public API:** Target `src/features/export/index.ts` exports the export dialog and PNG entry point. This entry point does not exist yet.
- **State slice:** None; reads the current project document.
- **Depends on:** Projects/map document types and shared drawing data.
- **Must not regress:** Transparent background, map-only output, shape/outline/elevation fidelity, hidden-object behavior, and export cancellation/sizing.

## Projects

- **Purpose:** Create, open, save, validate, import, autosave, and restore local map documents.
- **Owned files:** `src/features/projects/` for project operations and sample documents; `src/hooks/useAutosave.ts`, `src/lib/storage.ts`, `validation.ts`, `image.ts`, and `download.ts` are current supporting modules.
- **Public API:** `src/features/projects/index.ts`; currently exports project file operations and empty/sample documents.
- **State slice:** Target document lifecycle and undo/redo history slice; currently in `src/state/slices/document.ts`.
- **Depends on:** Shared map/project types and shared browser-storage/download utilities. It must not import UI components.
- **Must not regress:** Versioned JSON compatibility, validation of imported data, autosave restore, empty-document initialization, image backgrounds, and legacy cutout migration.

## Shared

- **Purpose:** Hold reusable UI and low-level helpers that do not belong to a single feature.
- **Owned files:** Target `src/shared/`; current shared toast is `src/components/Toast.tsx`, common domain types are in `src/types/`, and pure utilities are in `src/lib/`.
- **Public API:** Target `src/shared/index.ts` exports reusable primitives/helpers. This entry point does not exist yet.
- **State slice:** Shared UI slice for theme/toast; currently `src/state/slices/ui.ts` also contains grid/snap actions that should move to canvas.
- **Depends on:** Shared libraries and types only. **Must never import from `src/features/`.**
- **Must not regress:** Toast lifecycle, browser theme persistence, shared schema/type compatibility, and pure helper determinism.
