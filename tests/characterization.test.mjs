import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const loadTypeScript = (jsx) => (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
require.extensions['.ts'] = loadTypeScript(false);
require.extensions['.tsx'] = loadTypeScript(true);

const geometry = require('../src/lib/geometry.ts');
const validation = require('../src/lib/validation.ts');
const storeModule = require('../src/stores/editorStore.ts');
const exportModule = require('../src/features/export/exportPng.ts');
const eraserHandlers = require('../src/features/eraser/index.ts');
const pointHandlers = require('../src/features/selection/handlers/point.ts');
const selectHandlers = require('../src/features/selection/handlers/select.ts');
const drawingHandlers = require('../src/features/drawing/handlers/shapeDrawing.ts');

const { rectPts, snapValue, pointInPolygon } = geometry;
const { parseProject, parseProjectText, serializeProject, ProjectParseError } = validation;
const { useEditorStore } = storeModule;
const { paintSheet, renderPng } = exportModule;
const { elevationFill } = require('../src/types/map.ts');

const floorRect = (id = 'floor-1') => ({
  id,
  type: 'rect',
  kind: 'floor',
  pts: [[10, 10], [90, 10], [90, 90], [10, 90]],
});

function resetStore(shapes = []) {
  useEditorStore.getState().hydrate({ name: 'Test map', shapes, background: null });
}

test('store composition keeps the public actions available across feature slices', () => {
  const state = useEditorStore.getState();
  const actions = [
    'hydrate', 'undo', 'redo', 'act', 'addShape', 'cutoutArea', 'select', 'detachPolygonsInBox',
    'setTool', 'finishPolygon', 'addErasurePoint', 'setViewport', 'zoomAt', 'groupSelectedLayers',
    'renameLayer', 'patchElevation', 'setSelectedOutline', 'showToast', 'toggleGrid',
  ];
  for (const action of actions) assert.equal(typeof state[action], 'function', `${action} remains public`);
});

test('project JSON preserves editable shape fields and rejects malformed input', () => {
  const doc = {
    name: 'Round trip',
    shapes: [{ ...floorRect(), outline: 'black', outlineWidth: 2, edgeGaps: [[[0.2, 0.4]], [], [], []] }],
    background: null,
  };
  const wire = serializeProject(doc);
  const parsed = parseProject(wire);
  assert.equal(parsed.skipped, 0);
  assert.equal(JSON.stringify(serializeProject(parsed.doc)), JSON.stringify(wire));
  assert.throws(() => parseProjectText('{broken'), ProjectParseError);
});

for (const file of readdirSync(new URL('../maps/', import.meta.url)).filter((name) => name.endsWith('.json'))) {
  test(`map fixture ${file} parses and round-trips without skipped shapes`, () => {
    const text = readFileSync(new URL(`../maps/${file}`, import.meta.url), 'utf8');
    const first = parseProjectText(text);
    assert.equal(first.skipped, 0);
    const normalized = serializeProject(first.doc);
    const second = parseProject(normalized);
    assert.equal(second.skipped, 0);
    assert.equal(JSON.stringify(serializeProject(second.doc)), JSON.stringify(normalized));
  });
}

test('geometry normalizes rectangle corners, snaps to grid, and tests polygon interiors', () => {
  assert.deepEqual(rectPts(8, 9, 2, 3), [[2, 3], [8, 3], [8, 9], [2, 9]]);
  assert.equal(snapValue(13, { snap: true, alt: false, gridSize: 5 }), 15);
  assert.equal(snapValue(13.26, { snap: true, alt: true, gridSize: 5 }), 13.3);
  assert.equal(snapValue(-4, { snap: false, alt: false, gridSize: 5 }), 0);
  assert.equal(pointInPolygon({ x: 5, y: 5 }, [[0, 0], [10, 0], [10, 10], [0, 10]]), true);
  assert.equal(pointInPolygon({ x: 15, y: 5 }, [[0, 0], [10, 0], [10, 10], [0, 10]]), false);
});

test('extracted shape drawing handler starts, updates, and commits a rectangle draft', () => {
  resetStore();
  drawingHandlers.beginShapeDrawing(useEditorStore.getState(), 'rect', { x: 10, y: 20 }, { x: 10, y: 20 });
  drawingHandlers.moveShapeDraft(useEditorStore.getState(), { x: 80, y: 90 }, { x: 80, y: 90 });
  drawingHandlers.finishShapeDraft(useEditorStore.getState());
  const shape = useEditorStore.getState().doc.shapes[0];
  assert.equal(shape.type, 'rect');
  assert.deepEqual(shape.pts, [[10, 20], [80, 20], [80, 90], [10, 90]]);
});

test('line drawing snaps to an existing endpoint and commits a separate line', () => {
  const original = { id: 'line-a', type: 'line', kind: 'floor', pts: [[21, 21], [60, 60]] };
  resetStore([original]);
  const state = useEditorStore.getState();

  assert.deepEqual(drawingHandlers.nearestLineEndpoint(state.doc.shapes, { x: 22, y: 21 }, state.view.scale), {
    shapeId: 'line-a', index: 0, point: [21, 21],
  });
  drawingHandlers.beginShapeDrawing(state, 'line', { x: 22, y: 21 }, { x: 20, y: 20 });
  assert.deepEqual(useEditorStore.getState().draft.a, { x: 21, y: 21 });
  drawingHandlers.moveShapeDraft(useEditorStore.getState(), { x: 100, y: 100 }, { x: 100, y: 100 });
  drawingHandlers.finishShapeDraft(useEditorStore.getState());

  const lines = useEditorStore.getState().doc.shapes;
  assert.equal(lines.length, 2);
  assert.equal(lines[0].id, 'line-a');
  assert.equal(lines[1].type, 'line');
  assert.notEqual(lines[1].id, lines[0].id);
  assert.deepEqual(lines[1].pts[0], [21, 21]);
});

test('extracted point and select handlers retain vertex insertion and movement behavior', () => {
  const original = floorRect();
  resetStore([original]);
  pointHandlers.handlePointTool(useEditorStore.getState(), [original], { x: 50, y: 10 });
  assert.equal(useEditorStore.getState().doc.shapes[0].pts.length, 5);

  resetStore([original]);
  const drag = selectHandlers.beginSelectTool(useEditorStore.getState(), { x: 20, y: 20 }, { shiftKey: false, altKey: false }, { style: {} });
  assert.equal(drag?.mode, 'move');
  selectHandlers.updateSelectDrag(useEditorStore.getState(), { x: 30, y: 40 }, { x: 30, y: 40 }, drag, { snap: false, alt: false, gridSize: 2 }, snapValue);
  assert.deepEqual(useEditorStore.getState().doc.shapes[0].pts[0], [20, 30]);
  assert.deepEqual(selectHandlers.selectHoverTargetAt(useEditorStore.getState().doc.shapes, { x: 20, y: 30 }, 1, null), { shapeId: original.id, part: 'vertex', index: 0, ring: 0 });
});

test('store add, undo, and redo preserve document history', () => {
  resetStore();
  const shape = floorRect();
  useEditorStore.getState().addShape(shape);
  assert.equal(useEditorStore.getState().doc.shapes.length, 1);
  useEditorStore.getState().undo();
  assert.equal(useEditorStore.getState().doc.shapes.length, 0);
  useEditorStore.getState().redo();
  assert.equal(useEditorStore.getState().doc.shapes[0].id, shape.id);
});

test('layers can be grouped, add a member, and ungroup one member independently', () => {
  const shapes = [floorRect('back'), floorRect('middle'), floorRect('front')];
  resetStore(shapes);
  const state = useEditorStore.getState();
  for (const shape of shapes) state.toggleGroupingSelection(shape.id);
  useEditorStore.getState().groupSelectedLayers();

  let grouped = useEditorStore.getState().doc.shapes;
  const groupId = grouped[0].groupId;
  assert.ok(groupId);
  assert.deepEqual(grouped.map((shape) => shape.id), ['back', 'middle', 'front']);
  assert.equal(grouped.every((shape) => shape.groupId === groupId), true);

  const extra = floorRect('extra');
  useEditorStore.getState().addShape(extra);
  useEditorStore.getState().addLayerToGroup(extra.id, groupId);
  grouped = useEditorStore.getState().doc.shapes;
  assert.deepEqual(grouped.map((shape) => shape.id), ['back', 'middle', 'front', 'extra']);
  assert.equal(grouped.at(-1).groupId, groupId);

  useEditorStore.getState().toggleGroupingSelection('back');
  useEditorStore.getState().ungroupSelectedLayers();
  grouped = useEditorStore.getState().doc.shapes;
  assert.equal(grouped.find((shape) => shape.id === 'back').groupId, undefined);
  assert.equal(grouped.filter((shape) => shape.id !== 'back').every((shape) => shape.groupId === groupId), true);
});

test('layers and groups reorder without changing group membership or member order', () => {
  const groupId = 'group-a';
  const shapes = [
    floorRect('member-1'),
    { ...floorRect('member-2'), groupId },
    { ...floorRect('member-3'), groupId },
    floorRect('solo'),
  ];
  resetStore(shapes);

  useEditorStore.getState().reorderGroup(groupId, 'solo', 'layer', 'before');
  let reordered = useEditorStore.getState().doc.shapes;
  assert.deepEqual(reordered.map((shape) => shape.id), ['member-1', 'solo', 'member-2', 'member-3']);
  assert.deepEqual(reordered.slice(-2).map((shape) => shape.id), ['member-2', 'member-3']);
  assert.equal(reordered.filter((shape) => shape.groupId === groupId).length, 2);

  useEditorStore.getState().reorderLayer('member-1', groupId, 'group', 'before');
  reordered = useEditorStore.getState().doc.shapes;
  assert.equal(reordered.find((shape) => shape.id === 'member-1').groupId, undefined);
  assert.deepEqual(reordered.filter((shape) => shape.groupId === groupId).map((shape) => shape.id), ['member-2', 'member-3']);
});

test('properties update only the selected edge and clamp surface elevation', () => {
  resetStore([floorRect()]);
  const state = useEditorStore.getState();
  state.select('floor-1');
  state.selectEdge(1);
  state.setSelectedEdgeOutline('white');
  state.setSelectedOutlineWidth(2.5);

  let shape = useEditorStore.getState().doc.shapes[0];
  assert.equal(shape.edgeOutlines[1], 'white');
  assert.deepEqual(shape.edgeOutlines.filter((_, index) => index !== 1), []);
  assert.equal(shape.edgeWidths[1], 2.5);
  assert.deepEqual(shape.edgeWidths.filter((_, index) => index !== 1), []);

  state.patchElevation('floor-1', 7);
  shape = useEditorStore.getState().doc.shapes[0];
  assert.equal(shape.elevation, 7);
  assert.notEqual(elevationFill('floor', -10), elevationFill('floor', 10));
  state.patchElevation('floor-1', 99);
  assert.equal(useEditorStore.getState().doc.shapes[0].elevation, 10);
});

test('area eraser stores a continuous stroke on the target shape', () => {
  resetStore([floorRect()]);
  const state = useEditorStore.getState();
  state.addErasurePoint('floor-1', [20, 20], true);
  state.addErasurePoint('floor-1', [24, 20], false);
  state.addErasurePoint('floor-1', [24.1, 20], false);
  const strokes = useEditorStore.getState().doc.shapes[0].erasures;
  assert.deepEqual(strokes, [[[20, 20], [24, 20]]]);
});

test('extracted eraser handler preserves area and edge modes', () => {
  resetStore([floorRect()]);
  let drag = eraserHandlers.beginEraser(useEditorStore.getState(), { x: 50, y: 50 }, false);
  assert.equal(drag?.mode, 'erase-area');
  eraserHandlers.moveEraser(useEditorStore.getState(), { x: 54, y: 50 }, drag);
  assert.equal(useEditorStore.getState().doc.shapes[0].cutouts.length, 1);

  resetStore([floorRect()]);
  useEditorStore.getState().setEraserMode('edges');
  drag = eraserHandlers.beginEraser(useEditorStore.getState(), { x: 50, y: 10 }, false);
  assert.equal(drag?.mode, 'erase-boundaries');
  eraserHandlers.finishBoundaryEraser(useEditorStore.getState(), drag);
  assert.equal(useEditorStore.getState().doc.shapes[0].pts.length, 6);
});

test('edge eraser creates outline gaps and finalizes their endpoints as polygon vertices', () => {
  resetStore([floorRect()]);
  const state = useEditorStore.getState();
  state.addPolygonEdgeGap('floor-1', 0, 0.5);
  const gapShape = useEditorStore.getState().doc.shapes[0];
  assert.equal(gapShape.edgeGaps[0].length, 1);
  state.finalizePolygonEdgeGaps('floor-1');
  const finalized = useEditorStore.getState().doc.shapes[0];
  assert.equal(finalized.pts.length, 6);
  assert.equal(finalized.edgeGaps, undefined);
  assert.equal(finalized.edgeOutlines.filter((outline) => outline === 'none').length, 1);
});

test('filled cutout subtracts from the existing shape, creates no cutter layer, and is undoable', () => {
  resetStore([floorRect()]);
  const cutter = {
    id: 'cutter',
    type: 'rect',
    kind: 'cut',
    pts: [[30, 30], [70, 30], [70, 70], [30, 70]],
  };
  useEditorStore.getState().cutoutArea(cutter);
  const afterCut = useEditorStore.getState().doc.shapes;
  assert.equal(afterCut.some((shape) => shape.id === 'cutter'), false);
  assert.equal(afterCut.length, 1);
  assert.equal(afterCut[0].type, 'poly');
  assert.equal(afterCut[0].holes.length, 1);
  useEditorStore.getState().undo();
  assert.deepEqual(useEditorStore.getState().doc.shapes, [floorRect()]);
});

test('legacy cutout layers are baked during hydration instead of remaining movable layers', () => {
  const floor = floorRect();
  const legacyCutout = {
    id: 'legacy-cutout',
    type: 'rect',
    kind: 'cut',
    pts: [[30, 30], [70, 30], [70, 70], [30, 70]],
  };
  resetStore([floor, legacyCutout]);
  const shapes = useEditorStore.getState().doc.shapes;
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].id, floor.id);
  assert.equal(shapes[0].holes.length, 1);
});

test('box detach splits editable source and extracted areas and selects the results', () => {
  resetStore([floorRect()]);
  useEditorStore.getState().detachPolygonsInBox([30, 30], [70, 70]);
  const state = useEditorStore.getState();
  assert.equal(state.doc.shapes.length, 2);
  assert.equal(state.doc.shapes.every((shape) => shape.type === 'poly'), true);
  assert.equal(state.doc.shapes.filter((shape) => shape.detached).length, 2);
  assert.equal(state.marqueeSelection.length, 2);
  state.undo();
  assert.deepEqual(useEditorStore.getState().doc.shapes, [floorRect()]);
});

test('PNG painter draws visible shapes but does not paint a white sheet background', () => {
  const calls = [];
  const ctx = new Proxy({ canvas: { width: 128, height: 128 } }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  paintSheet(ctx, {
    name: 'Export',
    background: null,
    shapes: [floorRect(), { ...floorRect('hidden'), hidden: true }],
  });
  assert.equal(calls.some(([name]) => name === 'fillRect'), false);
  assert.equal(calls.filter(([name]) => name === 'fill').length, 1);
});

test('PNG export creates a square canvas at the requested pixel size', async () => {
  const transforms = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob(callback, type) {
      assert.equal(type, 'image/png');
      callback(new Blob([], { type }));
    },
  };
  const context = { canvas, setTransform: (...args) => transforms.push(args) };
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tag) => {
        assert.equal(tag, 'canvas');
        return canvas;
      },
      fonts: { load: async () => [] },
    },
  });

  try {
    const blob = await renderPng({ name: 'Sizing', shapes: [], background: null }, 512);
    assert.deepEqual([canvas.width, canvas.height], [512, 512]);
    assert.deepEqual(transforms[0], [512 / 360, 0, 0, 512 / 360, 0, 0]);
    assert.equal(blob.type, 'image/png');
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  }
});
