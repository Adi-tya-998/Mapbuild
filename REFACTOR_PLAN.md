# Mapbuild Feature-Boundary Refactor Plan

## Step 0 inventory

This inventory describes the project snapshot at `ea0644e` (`Cutout changes`) in the isolated `experiment/feature-boundaries` worktree, tagged `pre-refactor` on `main`. The refactor branch was rebased onto that commit. The baseline includes the cutout implementation in `src/features/drawing/CanvasNodes.tsx`, `src/features/drawing/useCanvasInteractions.ts`, `src/lib/exportPng.ts`, and `src/stores/editorStore.ts`. A remote fetch could not resolve `github.com`, so remote freshness could not be confirmed and this branch remains local. Do not treat this plan as approval to begin Step 1.

## 1. Current file inventory

| File | Responsibility | Feature(s) served |
|---|---|---|
| `.github/workflows/deploy.yml` | Builds and publishes the static Vite site to GitHub Pages. | Deployment / app |
| `.gitignore` | Excludes generated dependencies, build output, and local files from Git. | Repository tooling |
| `README.md` | Project setup and development documentation. | Documentation |
| `index.html` | Vite HTML entry point and document metadata. | App shell |
| `package.json` | Runtime/dev dependencies and npm scripts. | Build tooling |
| `package-lock.json` | Locks dependency versions for reproducible installs. | Build tooling |
| `tsconfig.json` | TypeScript compiler configuration. | Build tooling |
| `vite.config.ts` | Vite and React plugin configuration. | Build tooling |
| `public/favicon.svg` | Static browser favicon. | App shell / assets |
| `maps/ascent-recreated.json` | Editable Ascent project data asset; no direct source import was found in the current app. | Map data / projects |
| `maps/valoplant-strategy-recreated.json` | Editable strategy-map data asset; no direct source import was found in the current app. | Map data / projects |
| `maps/valoplant-strategy-transparent-recreated.json` | Transparent strategy-map data asset; no direct source import was found in the current app. | Map data / projects |
| `src/main.tsx` | Creates the React root and imports Bootstrap and app styles. | App shell / styling |
| `src/App.tsx` | Composes the toolbar, canvas, panels, export dialog, autosave, startup hydration, and theme setup. | App shell / projects / toolbar |
| `src/styles/index.css` | Defines design tokens, responsive editor layout, and all application styling. | Styling across all features |
| `src/types/map.ts` | Defines map objects, tools, surface kinds, outlines, drafts, and rendering constants. | Shared domain model / drawing / properties |
| `src/types/project.ts` | Defines project, map-content, background, and JSON-file interfaces/constants. | Projects / document |
| `src/stores/editorStore.ts` | Owns the complete Zustand state, actions, undo/redo, shape geometry edits, grouping, viewport, and surface/eraser behavior. | Document / drawing / selection / canvas / layers / properties / UI |
| `src/components/EditorToolbar.tsx` | Renders map name, official-map selector, grid/snap/zoom/theme and file actions. | Toolbar / projects / canvas / history |
| `src/components/ExportDialog.tsx` | Configures and starts PNG export in a native dialog. | Export |
| `src/components/LayersPanel.tsx` | Lists, selects, hides, groups, renames, and reorders shapes and groups. | Layers / selection |
| `src/components/MapCanvas.tsx` | Builds the Konva stage, connects drawing interactions, renders map and overlays, and accepts dropped files. | Canvas / drawing / selection / projects |
| `src/components/PropertiesPanel.tsx` | Edits surface, elevation, outline, label, background, and selected-object properties. | Properties / document |
| `src/components/StatusBar.tsx` | Shows cursor measurements and the active tool's instruction. | Toolbar / drawing |
| `src/components/Toast.tsx` | Displays transient editor messages from store state. | Shared UI / UI state |
| `src/components/ToolRail.tsx` | Renders tool buttons and the eraser-mode selector. | Toolbar / drawing / eraser |
| `src/features/drawing/CanvasNodes.tsx` | Renders shapes, background image, grid, draft previews, selection/hover handles, and editor overlays. | Canvas / drawing / selection / eraser |
| `src/features/drawing/tools.ts` | Defines tool metadata, icons, labels, key bindings, and long status-bar hints. | Drawing / toolbar |
| `src/features/drawing/useCanvasInteractions.ts` | Handles canvas pointer/keyboard interaction for drawing, selection, transforms, detach, area erasing, edge erasing, add-point, pan, and cursor updates. | Canvas / drawing / selection / eraser |
| `src/features/projects/projectIO.ts` | Opens and saves JSON files, imports background images, handles dropped files, and reports outcomes through the store. | Projects / import-export / UI |
| `src/features/projects/sampleProject.ts` | Builds the initial example map and empty project documents. | Projects / document |
| `src/hooks/useAutosave.ts` | Subscribes to document changes and debounces serialization to browser storage. | Projects / document |
| `src/hooks/useEditorHistory.ts` | Exposes undo/redo availability and keyboard shortcuts. | Document / history |
| `src/hooks/useEditorShortcuts.ts` | Handles tool, delete, nudge, ordering, pan, and modifier-key shortcuts. | Toolbar / drawing / selection |
| `src/lib/download.ts` | Creates browser downloads and safe file names. | Shared utility / projects / export |
| `src/lib/exportPng.ts` | Paints map objects and renders transparent PNGs. | Export / document |
| `src/lib/geometry.ts` | Contains geometry, hit testing, snapping, sizing, transforms, and fit calculations. | Shared utility / canvas / drawing / selection |
| `src/lib/id.ts` | Creates unique object identifiers. | Shared utility / document / projects |
| `src/lib/image.ts` | Reads images and computes image fitting geometry. | Shared utility / projects / canvas |
| `src/lib/storage.ts` | Saves/restores autosave and theme preferences using IndexedDB/localStorage. | Projects / app preferences |
| `src/lib/validation.ts` | Validates/parses project JSON and serializes project documents with Zod. | Projects / document |

## 2. Store member inventory by feature

The public store contract is `EditorState` at `src/stores/editorStore.ts:39-142`; the Zustand store is instantiated at line 241. Its current single API is consumed directly across UI, hooks, project I/O, and drawing code.

| State/action group | Current members | Main readers/writers |
|---|---|---|
| Document and shape data | `doc`, `status`, `setName`, `newProject`, `openDocument`, `resetSheetForOfficialMap`, `addShape`, `finishPolygon`, `removeSelected`, `reorderSelected`, `duplicateSelected`, `patchLabel`, `patchElevation`, `setSelectedOutlineWidth`, `setSelectedOutline`, `setSelectedEdgeOutline`, `setBackground`, `patchBackground` | `App` hydrates; `useAutosave` reads/serializes; `MapCanvas` renders; `PropertiesPanel` edits; `LayersPanel` reads and hides/reorders; `projectIO` opens/saves/imports; `ExportDialog` reads; `useCanvasInteractions` creates and edits shapes. Core contract at `editorStore.ts:44,119-142`; actions around `486-762`. |
| Selection and manipulation | `selectedId`, `selectedEdgeIndex`, `hoverTarget`, `marqueeSelection`, `selectionBox`, `select`, `setMarqueeSelection`, `setSelectionBox`, `selectEdge`, `setHoverTarget`, `nudgeSelected`, `addPolygonVertex`, `detachPolygonsInBox` | `MapCanvas` reads to render overlays; `PropertiesPanel` reads selection and chooses edges; `LayersPanel` selects; `useCanvasInteractions` performs hit detection, movement, vertices, rotation, box selection, and detach. State at `editorStore.ts:47-51`; actions at `90-95,124-130,505-573,607-620`. |
| Tool selection, drawing, erasing, and cutouts | `tool`, `kind`, `eraserMode`, `draft`, `cursor`, `rawCursor`, `altKey`, `spaceHeld`, `setTool`, `setKind`, `setEraserMode`, `setDraft`, `setCursor`, `setAlt`, `setSpaceHeld`, `finishPolygon`, `cutoutArea`, `addErasurePoint`, `addCutoutPoints`, `addPolygonEdgeGap`, `finalizePolygonEdgeGaps` | `ToolRail`, `PropertiesPanel`, `MapCanvas`, `StatusBar`, `useEditorShortcuts`, and `useCanvasInteractions`. State at `editorStore.ts:52-60`; actions at `81-94,124,137-140,277-305,340-350,572-594,656-760`. Filled cutouts are applied as geometry subtraction and do not create movable cutout layers. |
| View, viewport, grid, and snap | `view`, `viewport`, `autoFit`, `grid`, `snap`, `gridSize`, `setViewport`, `fitView`, `zoomAt`, `panBy`, `toggleGrid`, `toggleSnap`, `setGridSize` | `EditorToolbar` reads grid/snap/size/zoom; `MapCanvas` reads view/grid and reports viewport; `useCanvasInteractions` handles pan/zoom/snap. State at `editorStore.ts:61-68`; actions at `84-85,105-108,286-288,417-437`. |
| Groups and layer UI state | `groupingSelection`, `toggleGroupingSelection`, `groupSelectedLayers`, `addLayerToGroup`, `renameLayer`, `renameGroup`, `reorderGroup`, `reorderLayer`, `ungroupSelectedLayers`, `toggleHidden` | `LayersPanel` is the primary reader/writer; shape movement logic in `useCanvasInteractions` also moves grouped members. State at `editorStore.ts:57`; contract at `96-103,131`; implementations at `307-416,621-624`. |
| Undo/redo history | `past`, `future`, `pending`, `checkpoint`, `commit`, `act`, `liveEdit`, `undo`, `redo` | `useEditorHistory` reads history and dispatches undo/redo; `EditorToolbar` presents availability; drawing, properties, layers, and store actions checkpoint or call `act`. State at `editorStore.ts:71-73`; contract at `110-117`; implementations at `439-485`. |
| Theme and transient UI | `theme`, `toast`, `setTheme`, `showToast`, `clearToast` | `App` reads/writes theme and persists it; `EditorToolbar` selects theme; `Toast` displays/clears messages; `projectIO`, layers, drawing, and store actions show messages. State at `editorStore.ts:69-70`; actions at `77-79,273-275`. |
| Project lifecycle and setup | `hydrate`, `openDocument`, `newProject`, `resetSheetForOfficialMap` | `App` startup + `sampleProject`; toolbar and `projectIO` load/clear; autosave stores serialized `doc`. Contract at `editorStore.ts:76,120-123`; implementation at `272,486-500`. |
| Shared store helpers | `findShape`, `mapShape`, `HoverTarget`, `ViewState`, `Viewport` | Imported by `MapCanvas`, `PropertiesPanel`, `CanvasNodes`, `useCanvasInteractions`, and store actions. Declarations at `editorStore.ts:17-37,147-154`. Their location in the global store module makes utility/type imports pull on a feature-owning module. |

## 3. Current dependency map and tangles

### Direct dependency overview

| Source | Direct internal dependencies and coupling |
|---|---|
| `src/App.tsx:2-13` | Imports every top-level panel, project sample, autosave/shortcuts, storage, and the global store. It is the current composition root but also performs startup persistence and theme setup. |
| `src/components/EditorToolbar.tsx:3-7` | Imports project I/O, geometry fit calculations, history hook, global store, and storage theme type. |
| `src/components/ExportDialog.tsx:3-5` | Imports shared download helpers, PNG renderer, and global store. |
| `src/components/LayersPanel.tsx:4-6` | Imports global store and map-model surface data. |
| `src/components/MapCanvas.tsx:6-13` | Imports drawing renderer, tool definitions, interaction hook, project file I/O, image loader, global store, map size, and Toast. This file is the canvas/UI integration point. |
| `src/components/PropertiesPanel.tsx:3-6` | Imports project background import, geometry sizing, global store, and map-model controls. |
| `src/components/StatusBar.tsx:1-2`; `ToolRail.tsx:1-2` | Import tool metadata and global store. |
| `src/components/Toast.tsx:2` | Reads transient UI state from the global store. |
| `src/features/drawing/CanvasNodes.tsx:4-9` | Imports geometry, image layout, base map/project types, and `HoverTarget` from the global store. Rendering currently includes map shapes, grid, background, draft, selection/hover UI, and eraser preview. |
| `src/features/drawing/useCanvasInteractions.ts:3-8` | Imports geometry, ID generation, `findShape`/`mapShape`/global store and store-defined `HoverTarget`, and map types/constants. It is the largest multi-feature interaction module. |
| `src/features/drawing/tools.ts:1-3` | Imports icon definitions and the shared `Tool` union. |
| `src/features/projects/projectIO.ts:1-4` | Imports download, image read, validation, and global store. Project workflows directly reach UI toast and editor state. |
| `src/features/projects/sampleProject.ts:1-4` | Imports IDs, rectangle geometry, map types, and project types. |
| `src/hooks/useAutosave.ts:2-4` | Imports storage, validation serialization, and global store. |
| `src/hooks/useEditorHistory.ts:2`; `useEditorShortcuts.ts:2-4` | Both import global store. Shortcuts also import drawing tool bindings and the typing-target helper from history. |
| `src/lib/exportPng.ts:1-4` | Imports map/project types and geometry. |
| `src/lib/geometry.ts:1-2` | Imports map constants/types. Geometry combines reusable geometric calculations for canvas, drawing, selection, and view fitting. |
| `src/lib/image.ts:1` | Imports the background model type. |
| `src/lib/storage.ts:1-3` | Imports project file types and project validation. |
| `src/lib/validation.ts:1-7` | Imports Zod, map/project types and constants, geometry clamp, and ID generation. |
| `src/types/project.ts:1` | Imports `MapObject` from the map model. |

### Tangled responsibilities / concrete refactor risks

1. `src/stores/editorStore.ts:1-11,39-142,241-783` imports geometry, IDs, theme storage, polygon clipping, project sample creation, and map/project types, then defines all store state and mutations. Geometry clipping helpers (`234-300`) sit beside store composition. `cutoutArea` (`572-594`) calls those helpers to subtract a filled polygon/rectangle/circle from underlying shapes; `setKind` and `finishPolygon` route selected or newly drawn cutouts into that action. Moving a slice may otherwise change behavior or create cross-slice cycles.
2. `src/features/drawing/useCanvasInteractions.ts:10-269,271-711` contains hit testing, object transforms, selection/rotation, add-point, detach, area eraser, edge eraser, drawing previews/drafts, pan, cursor updates, and subscriptions. The current pointer lifecycle (`onPointerDown`/move/up and `endDrag`) is shared across tool modes; extraction needs characterization tests before moving code.
3. `src/features/drawing/CanvasNodes.tsx:30-433` renders shape geometry, legacy cutout masks, holes/erasures, background image, grid, selection and hover handles, draft previews, and cursors. Newly applied filled cutouts are baked into shape geometry; legacy saved cutout layers are migrated during hydration/open. Preserve destination-out mask compositing for compatibility with legacy documents and matching PNG export behavior in `src/lib/exportPng.ts:196-250`.
4. `src/components/MapCanvas.tsx:34-213` selects many store fields in one subscription and composes `CanvasNodes` plus interactions. It is a cross-feature adapter and likely belongs in `features/canvas` or the app shell, not in both drawing and canvas.
5. The store exports `HoverTarget` and geometry helpers `findShape`/`mapShape` (`editorStore.ts:32-37,147-154`); canvas/drawing modules depend on types/helpers owned by the global state module. These should move to selection/document APIs without changing type shape or behavior.
6. Project I/O (`features/projects/projectIO.ts:4`) imports the store to open documents, set backgrounds, and show toasts. A clean project API must avoid a circular dependency between project persistence and store composition.
7. Store composition importing `features/projects/sampleProject` (`editorStore.ts:11`) while `App` independently imports the same sample (`App.tsx:9`) creates a shared setup dependency that should be owned by the projects feature and injected or re-exported through its public API.
8. `useEditorShortcuts.ts:2-4` crosses toolbar/drawing/history/store concerns; keyboard commands must retain exact routing and focus behavior. Keep the global key listener in a small app/toolbar adapter and delegate feature commands through public APIs.
9. `src/lib/geometry.ts` is shared by almost every geometry-heavy feature, but also contains view fitting and label metrics. It may need submodules within `shared/geometry` so feature boundaries do not turn shared into a catch-all.
10. `Toast` (`components/Toast.tsx`) is visually reusable but depends on store state. Either keep a shared presentational Toast and let the app adapter connect it, or document it as UI infrastructure rather than pure shared code.
11. Import enforcement plus a single composed Zustand store needs an explicit integration exception: a composition module must import slice creators, while feature UI needs access to the same store. Keep this as a one-way store facade/composition boundary; do not let slices import the composed store. The exact lint allowlist should encode that exception rather than create circular feature imports.
12. Reference JSON and PNG fixtures mentioned for final comparison have not yet been supplied in this worktree. Step 1 can create the comparison harness, but a byte-for-byte reference comparison must wait until those baseline files are available.
13. Cutout behavior spans polygon-clipping geometry in the store, draw-tool routing in the interaction hook, migration of legacy cutout layers on hydration/open, and destination-out compatibility in both canvas rendering and PNG export. Characterization must cover overlapping shapes, stack order, undo, saved legacy documents, and transparent PNG output before extracting these parts.

No behavior bugs are recorded in this inventory; it is not a behavioral audit. If a concrete bug is discovered during characterization, record it in `BUGS_FOUND.md` and do not fix it as part of the refactor.

## 4. Proposed target structure

```text
src/
  app/                         # App shell, startup, routing/layout, global listeners
  state/                       # Single Zustand composition root and stable useEditorStore facade
  shared/
    model/                     # Map/project base types and constants
    geometry/                  # Pure geometry, snapping, transforms, hit tests, fit helpers
    browser/                   # IDs, downloads, image decoding/fitting, storage primitives
    ui/                        # Presentational Toast and other feature-agnostic UI
  features/
    document/                  # Document slice, object CRUD, ordering, duplication, history
    canvas/                    # MapCanvas, CanvasNodes, viewport, grid, pan/zoom integration
    drawing/
      polygon/                 # Polygon tool handler
      rectangle/               # Rectangle tool handler
      circle/                  # Circle tool handler
      line/                    # Straight boundary handler
      curve/                   # Curve handler
      point/                   # Add-point handler
      label/                   # Label tool handler
      registry/                # Tool metadata and handler registry
    selection/                 # Select/edit, hover, vertex/rotation, box-select, nudge
    eraser/                    # Area erase, edge openings, detach/clip operations
    layers/                    # Layers panel and grouping/visibility/name/order API
    properties/                # Surface, elevation, outline, label and background controls
    toolbar/                   # EditorToolbar, ToolRail, StatusBar, global shortcut adapter
    export/                    # ExportDialog and PNG rendering
    projects/                  # Project I/O, validation, autosave, sample project
  styles/index.css             # Keep global styling unchanged during structural steps
```

`src/state/` is an explicit integration layer not present in the proposed list. It is needed to compose per-feature Zustand slices into the same `useEditorStore` without putting feature imports in `shared/` or letting a feature slice import the composed store. Slice creators expose only their slice state/actions; feature UI uses the stable store facade, and cross-feature operations go through documented public APIs. Import-boundary rules will permit `state/` to compose public slice APIs and prohibit imports between feature internals. Before Step 4, verify this API shape with a small dependency graph so it does not create a cycle.

### Migration order and risks

1. **Safety net first:** characterize parsing/serialization, geometry/snapping, store actions, detach/eraser, and export behavior; add reference JSON/PNG comparison harness. Risk: canvas rendering is browser-dependent, so headless coverage may stop at paint-call or pure helper assertions until browser fixtures are supplied.
2. **Store slices:** extract pure helpers, then document/history, selection, drawing/eraser, canvas, layer/property, and UI slices while preserving the `useEditorStore` public contract. Risk: methods currently combine document history with selection or eraser geometry; keep action bodies identical and add characterization for each boundary.
3. **Canvas interaction dispatcher:** first identify shared lifecycle vs mode-specific handlers; move behavior verbatim into per-tool handlers. Keep pointer coordinate conversion, pan, cursor, and shared drag lifetime in canvas integration. Risk: pointer capture, modifier state, keyboard completion, and event ordering.
4. **Public APIs/lint boundaries:** add feature indexes and an import graph policy with a documented `state/` composition exception. Risk: broad existing direct imports must be migrated incrementally; lint may otherwise enforce a circular architecture.
5. **Docs:** generate `AGENTS.md`, `FEATURES.md`, task template, and `BUGS_FOUND.md` from the final ownership boundaries. Risk: docs become stale unless tested alongside lint/API rules.
6. **Final verification:** run typecheck/lint/tests/build, compare reference outputs when provided, and deliver the feature-by-feature manual checklist for the user. Do not claim desktop UI verification; this environment's prompt explicitly assigns those checks to the user.

## Step 0 verification notes

- Current baseline: `ea0644e` (`Cutout changes`), tagged `pre-refactor`; the plan-only commit is `f2be5b7` (`Document feature refactor inventory and risks`) on `experiment/feature-boundaries`.
- Local branch: `experiment/feature-boundaries`, in a separate worktree and rebased onto `ea0644e`. The original `main` working tree is clean after the requested cutout commit.
- Remote update check: blocked by DNS resolution failure for `github.com`; local `main` has seven commits beyond its last known remote tracking ref, so remote freshness is unverified. This branch is not pushed.
- Step 0 makes no source-code changes. Step 1 requires explicit user approval (`continue`) after reviewing this plan.

## Step 1 safety-net notes

- Added a Node test command (`npm test`) without adding a package dependency, plus `tests/characterization.test.mjs`; it loads the current TypeScript modules and characterizes parsing/serialization, the checked-in map JSON files, geometry/snap behavior, store history, area and edge erasing, cutout subtraction and legacy migration, detach behavior, and transparent PNG paint calls.
- At Step 1 completion the suite had 12 passing cases. Step 3 adds three handler regression cases (15 total). The PNG assertion verifies the painter skips a white sheet fill and hidden objects; it is not a pixel-level screenshot comparison.
- `npm run build` passed against the same source baseline in the original project worktree. The refactor worktree has no local `node_modules`; tests were executed using the original worktree's installed dependencies through `NODE_PATH`. The test command itself needs only dependencies already declared in this project.
- No UI change was made. Reference screenshots for pixel-level export comparison remain unavailable, so that check is still pending before rendering internals are moved.
- Step 1 is complete. Stop here and wait for explicit `continue` before Step 2.

## Step 3 interaction-dispatch notes

- At the user's direction, Step 3 was done before the Step 2 store-slice extraction. The store stays as-is; Step 2 remains pending.
- Added `src/features/drawing/interactionTypes.ts` for pointer drag state and `src/features/drawing/handlers/` modules for selection/transform, shape drawing, point insertion, and eraser actions. `useCanvasInteractions.ts` retains the native event listeners, pointer capture, coordinate conversion, shared drag lifetime, pan/zoom, and completion/commit routing.
- The selection handler owns hit testing and shape movement/rotation/vertex edits; drawing handlers own tool draft start/move/finalization; eraser handlers own area and edge hit behavior; the point handler owns polygon edge insertion. Behavior was moved from the previous hook implementation, with regression cases added for the extracted paths.
- Verification: all 15 `npm test` cases passed. TypeScript checking passed with a temporary resolver configuration pointing to the original worktree dependencies. Vite's production build completed from this worktree; it reports the existing large-chunk advisory.
- No intentional behavior change. Manual desktop interaction review remains useful because the automated suite exercises handler logic but not real browser pointer capture or Konva event timing.
- Step 3 was completed ahead of Step 2 at the user's direction; proceed with Step 2 before the documentation step.

## Step 2 store-slice notes

- Extracted shared document/geometry helpers into `src/state/editorStoreHelpers.ts` and composed seven typed Zustand slices for document/history, selection, drawing/eraser, canvas/view, layers/groups, properties/background, and UI state.
- Kept `useEditorStore`, `EditorState`, and the existing action names available through `src/stores/editorStore.ts`; existing components and hooks continue using the same selectors and actions.
- Moved the existing action bodies verbatim into their slice modules. The wiring passes Zustand's store API to each slice creator; cross-slice calls still use the same `get()` actions.
- Added a public action-contract characterization. Verification: all 16 characterization cases passed, TypeScript check passed using the existing project dependency install, and the Vite production build completed. The existing large JavaScript chunk advisory remains. No intentional behavior change; pointer behavior remains covered by the extracted handler characterization tests, while visual browser checks remain manual.
- Step 2 is complete. Step 5 (documentation) is next and still requires explicit `continue`.
- Step 3 was completed ahead of Step 2 as requested; its handler split remains covered by characterization checks.

## Step 4 public API and boundary notes

- Added public entry points at `src/features/drawing/index.ts` and `src/features/projects/index.ts`, and migrated app/components/hooks to import those APIs instead of feature internals.
- Added `scripts/check-import-boundaries.mjs`, `import-boundaries.json`, and the `npm run check:boundaries` command. The checker parses TypeScript imports and rejects imports into another feature's private files; a temporary direct import probe was correctly rejected.
- The single documented exception is `src/stores/editorStore.ts` importing `src/features/projects/sampleProject.ts` for the empty-document initializer. Importing through the projects barrel would load project I/O, which currently imports the store; the public store facade remains in `stores/` after Step 2, so this exception remains documented.
- Verification after Step 2: boundary check passes, all 16 characterization tests pass, typecheck passes, and Vite production build passes with the existing large-chunk advisory.
- Step 4 is complete. Step 5 (docs) is next; wait for explicit `continue` before starting it.

## Step 5 documentation notes

- Added `AGENTS.md` with feature ownership, store/data conventions, import boundary rules, and local branch workflow.
- Added `FEATURES.md` as a user-facing inventory of current drawing, editing, layer, project, and export capabilities, including features that are intentionally not implemented yet.
- Added `TASK_TEMPLATE.md` for capturing scope, behavior that must stay unchanged, acceptance checks, verification, and branch/delivery choices.
- Added `BUGS_FOUND.md` to distinguish confirmed defects (none found in the characterization suite) from known limitations and manual verification gaps.
- Updated README commands, architecture map, and tests/limitations section to reflect the current refactor.
- Documentation-only change; no product behavior changed. The latest code verification from Step 2 passed all 16 characterization tests, boundary checks, TypeScript checking, and the production build. Step 6 final verification is next and requires explicit `continue`.

## Step 6 final verification notes

- Final verification on `experiment/feature-boundaries`: 16/16 characterization tests passed, `npm run check:boundaries` passed, TypeScript checking passed, and the Vite production build completed. The build retains the non-failing large-chunk warning and CJS Vite API deprecation notice.
- The original main project remains in its own clean worktree at `C:/Users/adity/Documents/Codex/2026-10-17/ca/minimapmaker`; all refactor source and build output are confined to `minimapmaker-refactor`.
- Desktop pointer, visual, and responsive behavior has not been manually verified in a browser. Use the manual checklist in the Step 6 handoff before treating interaction behavior as user-approved.
- No automated verification failures remain. Step 6 is complete, subject to user-run visual/manual checks.
