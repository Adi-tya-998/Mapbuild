# Feature guide

Mapbuild is a browser-based, local-first tactical map editor. It uses a 360 by 360 map sheet and stores project state in the browser; there is no backend, account system, cloud save, or online collaboration yet.

## Drawing and editing tools

| Tool | What it does | Useful for |
| --- | --- | --- |
| Select and edit (`V`) | Select, move, resize, rotate, and reshape objects; vertex handles allow point edits. | Refining map geometry after drawing. |
| Polygon (`P`) | Place vertices and close a filled polygon. | Irregular rooms, paths, and larger floor areas. |
| Rectangle (`R`) | Drag out a rectangle. | Quickly blocking out rectangular rooms or lanes. |
| Circle (`O`) | Drag from a center point to set its radius. | Circular cover or map markers. |
| Line boundary (`L`) | Draw a single straight boundary. | Walls or simple dividers that should not have a fill. |
| Curve boundary (`C`) | Sketch a smooth path. | Curved walls or non-linear boundaries. |
| Add point (`I`) | Insert a vertex on a polygon or rectangle edge. | Adding detail without redrawing a shape. |
| Eraser (`E`) | Erase only the swept area, erase boundaries with Ctrl+left-drag, or use edge-only mode to open polygon edges. | Making doors/openings or cleaning up overlaps. |
| Callout label (`T`) | Add editable text labels. | Naming sites or annotating a plan. |

## Map and layer controls

- Surfaces: Floor, Lane, and Site fills; the Cutout selection subtracts an area from existing filled geometry.
- Z elevation shades filled objects darker at lower values and lighter at higher values.
- Outlines can be clear, white, or black. Closed-shape sides can have individual outline styles; thickness has presets.
- The layer panel selects, hides, renames, groups, ungroups, and reorders objects. Grouped members move together while preserving their stack order.
- Ctrl+left-drag in Select and edit detaches the boxed area from polygons and exposes editable vertices. Ctrl+right-drag box-selects objects for bulk deletion.
- Official map selection currently clears the sheet; saved map layouts are not provided by that selector yet.

## Navigation, save, and export

- Toggle the grid and snapping; choose a grid step of 1, 2, 5, or 10 map units. Hold Alt to bypass snapping for supported tools.
- Zoom with the wheel or toolbar controls; pan with Space+drag or the middle mouse button.
- Undo/redo covers document edits. Arrow keys nudge, bracket keys change stack order, and Ctrl+D duplicates.
- The editor autosaves to browser storage. JSON open/save supports project portability, and background images can be imported or dropped onto the sheet.
- PNG export renders the created map with a transparent background.

## Not implemented yet

Backend services, user accounts, cloud saves, share links, real-time collaboration, and official premade map layouts are outside the current frontend build.
