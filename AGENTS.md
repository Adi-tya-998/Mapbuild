# Contributor guide

## Project scope

Mapbuild is a local-first React + TypeScript editor for tactical 2D maps. Keep edits in the feature that owns the behavior, preserve the map JSON contract, and avoid adding server, account, or cloud behavior unless a task explicitly asks for it.

## Edit boundary

Only edit files inside the feature named in the task. Do not touch other features, shared code, or store composition unless the task explicitly allows it. If a change seems to need another feature, STOP and report what is needed.

## Architecture and ownership

- `src/features/canvas/`: sheet rendering, viewport/grid/snap state, pointer lifecycle, and canvas interaction types.
- `src/features/drawing/`: tool metadata, shape creation handlers, and drawing state.
- `src/features/eraser/`: eraser handlers and eraser state.
- `src/features/selection/`: selection and point handlers, selection overlays, and selection state.
- `src/features/layers/`: layer/group panel and layer/group state.
- `src/features/properties/`: properties panel and selected-object/background state.
- `src/features/toolbar/`: editor toolbar, tool rail, status bar, and editor shortcuts.
- `src/features/export/`: export dialog and PNG rendering.
- `src/features/projects/`: project JSON I/O, background import, sample/empty documents, document state, and history.
- `src/shared/`: shared toast UI and transient theme/toast state. It must not import feature modules.
- `src/App.tsx` and `src/main.tsx`: application startup and feature composition. Keep application composition out of feature modules.
- `src/stores/editorStore.ts`: public Zustand store contract and slice composition. It imports each feature's `storeSlice.ts` directly to avoid loading UI barrels and creating runtime cycles. Keep `useEditorStore`, selector usage, and action signatures stable unless a task requires an API change.
- `src/state/editorStoreTypes.ts`: shared store types. `src/state/editorStoreHelpers.ts`: pure document/geometry helpers used across feature slices; both remain central to prevent one feature from owning shared contracts/helpers and creating feature dependencies.
- `src/types/`: map objects, editor tools, and project file types. `src/lib/`: geometry, validation, persistence, export, image, and download utilities.
- `tests/characterization.test.mjs`: behavior checks for project data, geometry, store actions, drawing, erasing/cutouts/detach, and PNG painting.

## Dependency boundaries

Feature-to-feature imports must use the owning feature's `index.ts`; imports within a feature may use its private files. The central store composer may import feature `storeSlice.ts` modules directly, plus canvas constants, to avoid runtime initialization cycles. Shared modules cannot import features, and feature modules cannot import application composition. Keep `import-boundaries.json` and `scripts/check-import-boundaries.mjs` aligned with these rules.

Run `npm run check:boundaries` after changing feature imports.

## Data and behavior

- The persistent project document is its name, shapes, and optional background. Selection, tool mode, draft geometry, viewport, and toast state are transient.
- All shape coordinates use map units on a 360 by 360 sheet. Zoom and pan must not rewrite object coordinates.
- Keep edits immutable and route document changes through the existing history actions (`act`, `checkpoint`, `liveEdit`, `commit`) according to the current gesture behavior.
- Cutouts are geometry subtraction, not movable cutout layers. Edge gaps, per-edge outline styles/widths, detached vertices, groups, and hidden state are persisted in map objects; preserve them when transforming or serializing shapes.
- Treat pointer capture, modifier keys, drag lifetime, and undo grouping as interaction-sensitive behavior. Keep shared event lifecycle in `features/canvas/useCanvasInteractions.ts` and tool-specific behavior in the owning feature's handlers.

## Local workflow

Use Node/npm. Install dependencies with `npm ci`, run the app with `npm run dev`, and use `npm run build` for typecheck plus production build. `npm test` runs the characterization suite; `npm run check:boundaries` checks feature imports.

Follow the repository branch workflow: start from a clean, updated `main`; use one `feature/`, `fix/`, `change/`, or `experiment/` branch per task; never commit or push directly to `main`; commit focused changes; and do not merge until the user approves. If GitHub is unavailable, state that the remote freshness check could not complete and keep work local.
