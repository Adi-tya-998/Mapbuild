# Contributor guide

## Project scope

Mapbuild is a local-first React + TypeScript editor for tactical 2D maps. Keep edits in the feature that owns the behavior, preserve the map JSON contract, and avoid adding server, account, or cloud behavior unless a task explicitly asks for it.

## Edit boundary

Only edit files inside the feature named in the task. Do not touch other features, shared code, or store composition unless the task explicitly allows it. If a change seems to need another feature, STOP and report what is needed.

## Architecture and ownership

- `src/components/`: application composition and UI panels. Keep interaction rules in their owning feature or store slice rather than adding domain logic to a component.
- `src/features/drawing/`: tool definitions, Konva rendering, pointer lifecycle, and per-tool drawing, selection, point, and eraser handlers. Public imports go through `src/features/drawing/index.ts`.
- `src/features/projects/`: project JSON open/save, background image import, dropped files, and sample/empty documents. Public imports go through `src/features/projects/index.ts`.
- `src/state/slices/`: Zustand action slices for document/history, selection, drawing/eraser, canvas/view, layers/groups, properties/background, and transient UI.
- `src/state/editorStoreHelpers.ts`: pure document/geometry helpers shared by the slices.
- `src/stores/editorStore.ts`: public Zustand store contract and slice composition. Keep `useEditorStore`, its selector usage, and action signatures stable unless a task requires an API change.
- `src/types/`: map objects, editor tools, and project file types. `src/lib/`: geometry, validation, persistence, export, image, and download utilities.
- `tests/characterization.test.mjs`: behavior checks for the serialized project format, geometry, store actions, drawing handlers, erasing/cutouts/detach, and PNG painting.

## Dependency boundaries

Cross-feature imports must use the owning feature's `index.ts`; imports within a feature may use its private files. `import-boundaries.json` lists the one checked exception: the store imports `sampleProject.ts` directly for its empty-document initializer because the projects barrel also loads project I/O, which imports the store. Do not add exceptions without explaining the cycle and updating the boundary policy.

Run `npm run check:boundaries` after changing feature imports.

## Data and behavior

- The persistent project document is its name, shapes, and optional background. Selection, tool mode, draft geometry, viewport, and toast state are transient.
- All shape coordinates use map units on a 360 by 360 sheet. Zoom and pan must not rewrite object coordinates.
- Keep edits immutable and route document changes through the existing history actions (`act`, `checkpoint`, `liveEdit`, `commit`) according to the current gesture behavior.
- Cutouts are geometry subtraction, not movable cutout layers. Edge gaps, per-edge outline styles/widths, detached vertices, groups, and hidden state are persisted in map objects; preserve them when transforming or serializing shapes.
- Treat pointer capture, modifier keys, drag lifetime, and undo grouping as interaction-sensitive behavior. Keep shared event lifecycle in `useCanvasInteractions.ts` and tool-specific behavior in `features/drawing/handlers/`.

## Local workflow

Use Node/npm. Install dependencies with `npm ci`, run the app with `npm run dev`, and use `npm run build` for typecheck plus production build. `npm test` runs the characterization suite; `npm run check:boundaries` checks feature imports.

Follow the repository branch workflow: start from a clean, updated `main`; use one `feature/`, `fix/`, `change/`, or `experiment/` branch per task; never commit or push directly to `main`; commit focused changes; and do not merge until the user approves. If GitHub is unavailable, state that the remote freshness check could not complete and keep work local.
