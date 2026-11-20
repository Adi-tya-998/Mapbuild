# Bugs and verification gaps

## Confirmed defects

No new user-facing defect was confirmed by the automated characterization suite during the feature-boundary refactor.

## Known limitations

- Selecting an official map clears the current sheet; the selector does not load official layouts yet.
- The app is frontend-only and local-first. There are no accounts, cloud saves, share links, or live collaboration services.
- Touch drawing/selection is supported, but pinch zoom and two-finger pan are not implemented.
- The imported background image is fitted to the sheet and cannot be independently moved or scaled.
- Project JSON stores background images as data URLs, which can make project files large.
- PNG text rendering may differ slightly from the on-screen text rendering.

## Manual verification gaps

- The Node suite covers handler logic, but real Konva pointer capture, modifier-key timing, drag event ordering, and visual hover/selection feedback still need browser testing.
- PNG tests verify paint calls and transparent-sheet behavior; they are not pixel-by-pixel browser comparisons.
- Responsive panels and touch behavior have not been exhaustively reviewed across browsers and devices.

## Tooling note

The current production build succeeds with a Vite advisory that the main minified JavaScript chunk is larger than 500 kB. This is a bundle-size warning, not a build failure.
