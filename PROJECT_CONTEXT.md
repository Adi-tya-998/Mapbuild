# Minimap Maker — Project Context

Last updated: 2026-10-27

This file is a handoff note for future work on this repository. It separates shipped/current code from requested ideas and proposed technology. Do not treat the roadmap as implemented until the code and deployment confirm it.

## Product direction

The current product is **Minimap Maker**, a browser-based tactical map and strategy drawing editor. It started with VALORANT maps and is intended to grow toward richer VALORANT strategy-planning features, Valoplant/Tactival-inspired workflows, and potentially Counter-Strike maps and strategy planning. The public product/domain name beyond “Minimap Maker” has not been decided.

## What the website currently does

- Draw/edit floor, lane, site, and cutout areas using polygon/free-draw, rectangle, and circle tools.
- Draw straight boundaries and freehand curves; boundary strokes are white by default and can be set to clear, white, or black.
- Add labels/callouts, edit their text, size, and tone.
- Select and reshape vertices, insert/remove polygon vertices, move objects, nudge with the keyboard, duplicate, delete, and change stacking order.
- Select individual polygon sides and set their outline color. Outline thickness presets are available for a whole shape or a selected side; the app default is slimmer than the original.
- Erase portions of drawn lines/curves with the affected surface color. On polygon and rectangle edges, the eraser inserts two vertices at each doorway gap and creates a separate no-outline edge between them, leaving the room fill intact. New wall segments and endpoints are independently editable and are preserved in JSON and PNG exports. Rectangles with an opened edge become editable polygons.
- Set relative Z elevation for filled floor/lane/site surfaces: lower values shade darker and higher values lighter. Cutouts are unaffected. The requested gradient mode was tried and then reverted; current elevation shading is flat per shape.
- Group multiple layers, ungroup only selected members, add one existing layer to a group, rename layers/groups, collapse/expand groups, reorder groups, and move layers within/outside groups. Visibility toggles and front-to-back ordering are supported.
- Toggle the grid and magnetic snapping; choose grid spacing (1, 2, 5, or 10 map units). Hold Alt to bypass snapping while drawing. Curves follow the pointer without grid snapping.
- Pan/zoom, fit the sheet, switch themes, undo/redo, and autosave.
- Import a PNG/JPEG/WebP reference image, adjust its opacity, show/hide, replace, or remove it. The image is fitted within the sheet; it cannot currently be independently moved/scaled.
- Save/open editable project JSON. Export a transparent PNG of the map only; the canvas background, reference image, grid, and selection handles are excluded. Export size is selectable.

### Map selector status

The toolbar currently lists these official VALORANT map names: Abyss, Ascent, Bind, Breeze, Corrode, Fracture, Haven, Icebox, Lotus, Pearl, Split, Sunset, and Summit. Selecting one resets/names the sheet. **Preset map geometry is not implemented yet.**

### Current map asset

`maps/ascent-recreated.json` is a manually traced, approximate Ascent recreation based on the user-provided screenshot. It has 37 individually named polygon shapes; major areas including both sites and the attacker/defender spawns are single polygons. It intentionally contains no elevation values and no embedded screenshot background. Treat it as an editable draft, not an official/verified layout.

## Current technical stack

These are present in `package.json` or the current source:

| Area | Current choice |
| --- | --- |
| Language | TypeScript, with HTML and CSS |
| UI | React 18 / React DOM 18 |
| Build/dev server | Vite 5 with `@vitejs/plugin-react` |
| Map drawing/canvas | Konva 9 and `react-konva` 18 |
| Editor state and history | Zustand 5 |
| Import/data validation | Zod 3 |
| Icons | lucide-react |
| Browser storage | IndexedDB for autosave (with localStorage fallback); localStorage for theme preference |
| Map export | Browser canvas rendering to PNG; transparent background |
| Hosting/deploy | GitHub Pages, deployed by `.github/workflows/deploy.yml` on pushes to `main` |

Package version ranges are in `package.json`; this document does not pin exact resolved versions. Fonts (IBM Plex Sans, IBM Plex Mono, Barlow Condensed) are loaded from Google Fonts, with system fallbacks.

There is currently **no backend**, account system, cloud project storage, public share-link service, or simultaneous multi-user editing. Browser autosave is local to the browser/device.

## Project/file architecture

- `src/types/map.ts`: map object, tool, surface, outline, and map-coordinate types.
- `src/types/project.ts`: persistent project document and JSON file types.
- `src/stores/editorStore.ts`: Zustand document/UI state, grouping/reordering, editing actions, undo/redo.
- `src/features/drawing/`: tool definitions, pointer interactions, Konva canvas nodes.
- `src/features/projects/`: project open/save/import and starter project.
- `src/components/`: toolbar, tool rail, map canvas, layer/property panels, export dialog, status/toast UI.
- `src/lib/`: geometry, Zod validation, IndexedDB/localStorage, image, PNG export, and download helpers.
- `src/hooks/`: autosave, keyboard shortcuts, and undo/redo integration.

Persistent map content is separate from transient UI state. Map coordinates use a 360 × 360 unit sheet. The JSON format uses `app: "minimap-maker"`, version 2, project name, size, `shapes[]`, and optional background data. The Zod parser validates imports, drops invalid shapes, and retains compatibility with the original version 1 format. Shape fields are serialized with the document, including names, groups, per-edge outline styles/widths, and surface elevation.

## Planned product work (not implemented unless noted above)

1. **Official map templates:** create/load accurate editable layouts for the maps in the selector; add floors, sites, lanes, and key geometry as editable shapes.
2. **Tactical/strategy elements:** add game-specific symbols and tools for player positions, directional arrows, paths, callouts, smoke, flash, molly, recon, walls, and other utility. Keep editable layers and per-element properties.
3. **VALORANT workflows:** build strategy/round planning flows inspired by the kinds of features the user wants from Valoplant/Tactival, using original app code/assets and compatible user-owned content.
4. **Counter-Strike support:** add CS maps and planning tools. Keep game-specific assets and rules separate while reusing core editor, file, and layer capabilities where sensible.
5. **Accounts and cloud saves:** let users sign in, create a personal map library, and sync projects between devices. Keep anonymous/local editing usable where practical.
6. **Sharing:** begin with revocable read-only share links and map previews. Later add invited viewers/editors, teams, and possibly live collaboration.
7. **Reliability/product polish:** add automated validation/tests for map import/export and drawing data, backups/version history for cloud maps, mobile/touch improvements, and conflict handling before simultaneous editing.

## Recommended cloud/account stack (proposal, not installed)

Keep the existing React + Vite static frontend and GitHub Pages hosting initially. Connect it to **Supabase** rather than introducing a separate custom server for the first cloud version. This is a recommendation only; no Supabase project, credentials, dependency, schema, or policies exist in the repo yet.

- **Frontend SDK:** add `@supabase/supabase-js` when implementing sign-in and cloud access. Start with email magic-link/OTP sign-in; add social login only if desired.
- **Authentication:** Supabase Auth for accounts and sessions. Auth identifies users; database policies must separately authorize each operation. [Supabase Auth docs](https://supabase.com/docs/guides/auth) and [React quickstart](https://supabase.com/docs/guides/auth/quickstarts/react).
- **Cloud map records:** PostgreSQL tables such as `projects` (owner, title, game/map identifiers, timestamps, document version, JSONB document), and `project_members` (project, user, role). The current v2 map document can be the initial JSONB payload; add relational columns for fields that need searching/filtering. Supabase recommends `jsonb` for most flexible structured JSON data. [Supabase JSON docs](https://supabase.com/docs/guides/database/json).
- **Access control:** enable Postgres Row Level Security on every client-accessible table. Policies should let owners manage their maps, members do only the role-authorized actions, and anonymous users read only maps intentionally published for sharing. [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security).
- **Image storage:** move large reference/background images out of JSON data URLs into a private Supabase Storage bucket; store the object path in the project record. Use per-user/project storage policies. [Storage quickstart](https://supabase.com/docs/guides/storage/quickstart).
- **Share links:** use random, unguessable share tokens with read-only scope, optional expiry, and revocation. A `share_links` record can track project, token hash, expiry, and permissions. If a share token must grant access without an account, validate it through a small server-side Edge Function or equivalent endpoint; do not put privileged service credentials in the browser.
- **Secrets/config:** Vite client variables would be `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A publishable key is expected to be visible in the browser and is safe only with correct grants/RLS. Keep secret/service-role keys out of frontend code, Git, and Pages artifacts; use server-side secrets only. [Supabase key/security guidance](https://supabase.com/docs/guides/getting-started/api-keys) and [secure data docs](https://supabase.com/docs/guides/database/secure-data).
- **Live collaboration (later):** Supabase Realtime Broadcast can carry ephemeral cursor/selection events and Presence can show who is online; neither alone solves concurrent document edits. Start with saved-version checks and conflict warnings. If simultaneous editing becomes a requirement, choose and design a CRDT/document sync layer before implementation. Supabase recommends Broadcast for scalable realtime messaging and documents Presence for user state. [Realtime overview](https://supabase.com/docs/guides/realtime), [Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [Presence](https://supabase.com/docs/guides/realtime/presence).
- **Server code:** use Supabase Edge Functions only for tasks needing trusted server logic (for example validating bearer share links, generating previews, or rate-limited actions). The app does not need a custom server for its current editor functionality.

GitHub Pages remains a static host; it can host the frontend while Supabase provides remote auth/database/storage. Do not assume free-plan limits or long-term pricing: verify the provider’s current terms before launch.

## Immediate implementation order for cloud features

1. Define the project ownership/sharing model and whether read-only links are sufficient for the first release.
2. Create development and production Supabase projects; configure Vite env vars locally and in GitHub Actions secrets/variables as appropriate. Keep `.env.local` out of Git.
3. Add SQL migrations for profiles/projects/members/share links, enable RLS, and review policies before wiring the browser client.
4. Add Auth UI and a user project library; keep local JSON import/export and browser autosave as recovery/offline paths.
5. Store large reference images in private object storage and update open/save/migration flows.
6. Add revocable read-only sharing, then test unauthenticated/unauthorized access paths.
7. Consider editor invites and Realtime only after cloud saving and permission behavior are stable.

## Handoff / repository notes

- `README.md` is the short user/setup guide; this file is the broader product and architecture context.
- Current project root: `C:\Users\adity\Downloads\valoplant-editor\valoplant-editor`.
- At the time this note was written, the working tree contains uncommitted edits in the layer/property/canvas/validation/store/style/type files, plus the untracked `maps/` directory. Do not discard or overwrite them without checking with the user.
- A Git stash named `snapshot before z-axis depth feature` exists as a rollback point from before the Z-elevation work. Preserve it unless the user asks to remove it.
- The repository has a GitHub Pages workflow. A local build passing does not mean the changes are pushed or the GitHub Pages deployment has completed.
- No automated test suite is currently set up. `npm run typecheck` and `npm run build` are the current verification commands.
