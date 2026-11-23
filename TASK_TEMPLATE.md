# Feature or fix request

## Goal
What should change, and who benefits?

## Current behavior
What happens today? Include a screenshot, project JSON, or steps when useful.

## Expected behavior
Describe the result and important edge cases.

## Ownership and scope
- Owning feature (use a feature folder name below):
- Feature names: `canvas`, `drawing`, `eraser`, `export`, `layers`, `projects`, `properties`, `selection`, `toolbar`.
- If the task concerns shared infrastructure instead, name each permitted area explicitly (`shared`, `state`, `stores`, `app composition`, `lib`, `scripts`, or documentation).
- Files/modules likely involved:
- Behavior that must stay unchanged:
- Data format, migration, or export impact:
- Explicitly out of scope:

## Edit boundary

You may edit ONLY `src/features/<name>/**` and its tests for feature work. Do not modify shared infrastructure, store composition, application composition, scripts, or another feature unless the task explicitly allows that area. If another change is needed, stop and tell me.

## Acceptance checks
- [ ] User-visible behavior matches the expected behavior.
- [ ] Existing selection, layer order, undo/redo, and file behavior remain correct where applicable.
- [ ] Automated checks and manual browser checks are listed below.

## Verification
- Commands run:
- Browser/manual steps:
- Known limitations or risks:

## Branch and delivery
- Branch name:
- Local or remote work:
- Merge/push approval status:
