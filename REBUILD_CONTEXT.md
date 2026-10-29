# Minimap Maker local rebuild

This folder is a separate local rebuild workspace. It was copied from the existing Minimap Maker project so the original folder, repository, and Git history remain untouched. This folder is not a Git repository and nothing here has been pushed.

## Current direction

- Keep React, TypeScript, Vite, Konva, and `react-konva` for the interactive map editor.
- Add Bootstrap 5 for responsive layout, cards, badges, and form controls; theme the Bootstrap controls with the editor's light/dark palette.
- Keep Zustand for editor state/history, Zod for project-file validation, and lucide-react for icons.
- Keep project files and autosaves local in the browser. There is no account, API, cloud save, share link, or Java service in this rebuild yet.
- When backend work starts, use Java with Spring Boot and REST APIs. Cloud saves and sharing are intentionally deferred. The frontend should retain clear project import/export boundaries so it can later call Spring Boot without coupling editor state to the backend.
- MySQL is a possible future database for accounts/project metadata. It is not needed for this local-only editor stage.

## Carried-over editor capabilities

The source copy retains the existing implementation: polygon/free draw, rectangle, circle, straight line, curve, and boundary eraser tools; a right-click quick menu on the canvas for Polygon, Line, and Curve; surface and outline properties; individually editable polygon edges; elevation shading; labels; layers, groups, renaming, and ordering; grid and magnetic snapping; undo/redo; local autosave; JSON project import/export; image references; and transparent PNG export. When polygon/rectangle erasing finishes, each gap is materialized as two new vertices and a separate no-outline edge, so the remaining wall segments and doorway endpoints can be selected and edited independently. Rectangles with an opened edge become editable polygons. The official-map selector remains a selector/reset control; accurate preset geometry is not included for every map.

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a static frontend bundle. Spring Boot, MySQL, accounts, cloud storage, and sharing are not part of the current run configuration.
