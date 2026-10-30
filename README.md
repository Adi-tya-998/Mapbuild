# Minimap Maker (valoplant-editor)

A browser-based minimap editor: draw floors, lanes, sites and cutouts on a square 360-unit sheet, label them, and export a PNG or JSON. Frontend only: no backend, accounts or cloud. Everything is stored in your browser.

Stack: React, TypeScript, Vite, Konva + React Konva, Zustand, Zod, Lucide.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## Using the editor

| Action | How |
| --- | --- |
| Tools | `V` select, `P` polygon, `R` rectangle, `O` circle, `L` straight line, `C` curve, `T` label |
| Polygon | Click points; click the first point, double-click, or `Enter` to finish; `Backspace` removes the last point; `Esc` cancels |
| Circle | Drag from the center to set the radius |
| Line boundary | Drag between two points to draw a single straight white line |
| Curve boundary | Drag to sketch a smooth white curve; curves follow the pointer without grid snapping |
| Edit | Drag a shape to move it; drag a handle to reshape or resize; double-click a polygon edge to add a point; `Shift`-click a point to remove it |
| Nudge / order | Arrow keys (`Shift` = 5 units); `]` forward, `[` back; `Ctrl+D` duplicate; `Del` delete |
| Snapping | Toggle Snap and pick a grid size in the top bar; hold `Alt` to ignore snapping |
| Zoom / pan | Mouse wheel or the zoom buttons; pan with `Space`+drag or middle mouse button |
| Undo / redo | `Ctrl+Z`, `Ctrl+Shift+Z` / `Ctrl+Y` (a whole drag or typing session is one step) |
| Background | Properties panel → Import image (or drop an image on the sheet) |
| Files | **Save map** downloads JSON; **Open** (or drop a `.json`) loads it; **Export PNG** saves only map shapes on a transparent background |

The project autosaves a moment after every change and is restored on reload.

## Structure

```
src/
  components/     Toolbar, tool rail, canvas, layers + properties panels, export dialog, status bar, toast
  features/
    drawing/      Konva nodes, pointer interactions (draw/select/move/vertex/zoom/pan), tool definitions
    projects/     Open/save/import helpers and the example map
  hooks/          useEditorHistory (undo/redo), useAutosave, useEditorShortcuts
  stores/         editorStore.ts: document + transient UI state + history (Zustand)
  lib/            geometry, validation (Zod), storage (IndexedDB), exportPng, image, download
  types/          map.ts (objects), project.ts (document + file format)
```

Persistent data (`doc`: name, shapes, background) is kept apart from transient state (selection, tool, draft, view) in the store. All coordinates are in map units, so zooming, panning or resizing the window never changes the data.

## File format

JSON with `app: "minimap-maker"`, `version: 2`, `name`, `size: 360`, `shapes[]` and an optional `background` (image as a data URL). Maps saved by the original single-file editor (version 1) open as-is, and rectangles are written with `rect: true` so the original can still read exports. Imports are validated with Zod; invalid shapes are skipped and reported rather than failing the whole file.

## Known limitations

- Touch input draws and selects, but there is no pinch-zoom or two-finger pan yet; use the zoom buttons.
- The background image is fitted inside the sheet; it cannot be moved or scaled independently.
- PNG export uses a dedicated canvas painter (ported from the original), so label text can differ from the on-screen view by a fraction of a unit.
- Fonts (IBM Plex, Barlow Condensed) load from Google Fonts; offline, system fonts are used.
- Exported JSON includes the background image, so files with a background can be large.
- No automated tests are included yet.
