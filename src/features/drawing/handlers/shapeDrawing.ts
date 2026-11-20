import { createId } from '../../../lib/id';
import { rectPts, HIT_PX } from '../../../lib/geometry';
import type { EditorState } from '../../../stores/editorStore';
import type { Point, Tool, XY } from '../../../types/map';

/** Starts or advances a drawing tool draft. The canvas still owns pointer capture and coordinates. */
export function beginShapeDrawing(s: EditorState, tool: Tool, point: XY, snappedPoint: XY): boolean {
  if (tool === 'rect') {
    s.setDraft({ type: 'rect', a: snappedPoint, b: snappedPoint });
    return true;
  }
  if (tool === 'circle') {
    s.setDraft({ type: 'circle', center: snappedPoint, edge: snappedPoint });
    return true;
  }
  if (tool === 'line') {
    s.setDraft({ type: 'line', a: snappedPoint, b: snappedPoint });
    return true;
  }
  if (tool === 'curve') {
    // Curves follow the pointer directly; grid snapping creates visible stair steps.
    s.setDraft({ type: 'curve', pts: [[point.x, point.y]] });
    return true;
  }
  if (tool === 'poly') {
    const draft = s.draft;
    if (!draft || draft.type !== 'poly') {
      s.setDraft({ type: 'poly', pts: [[snappedPoint.x, snappedPoint.y]] });
      return true;
    }
    const first = draft.pts[0];
    const last = draft.pts[draft.pts.length - 1];
    const nearFirst = draft.pts.length >= 3 && Math.hypot(point.x - first[0], point.y - first[1]) * s.view.scale <= HIT_PX;
    const same = Math.abs(snappedPoint.x - last[0]) < 1e-6 && Math.abs(snappedPoint.y - last[1]) < 1e-6;
    if (nearFirst || (same && draft.pts.length >= 3)) s.finishPolygon();
    else if (!same) s.setDraft({ type: 'poly', pts: [...draft.pts, [snappedPoint.x, snappedPoint.y]] });
    return true;
  }
  if (tool === 'label') {
    s.addShape({ id: createId(), type: 'label', pts: [[snappedPoint.x, snappedPoint.y]], text: 'Label', size: 12, tone: 'light' });
    s.setTool('select');
    // Wait for the properties panel to render the new label's text field, then focus it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const input = document.getElementById('label-text') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }));
    return true;
  }
  return false;
}

/** Updates the active pointer-following draft while leaving the shared drag lifecycle in the canvas. */
export function moveShapeDraft(s: EditorState, point: XY, snappedPoint: XY): boolean {
  if (s.draft?.type === 'rect') {
    s.setDraft({ type: 'rect', a: s.draft.a, b: snappedPoint });
    return true;
  }
  if (s.draft?.type === 'circle') {
    s.setDraft({ type: 'circle', center: s.draft.center, edge: snappedPoint });
    return true;
  }
  if (s.draft?.type === 'line') {
    s.setDraft({ type: 'line', a: s.draft.a, b: snappedPoint });
    return true;
  }
  if (s.draft?.type === 'curve') {
    const last = s.draft.pts[s.draft.pts.length - 1];
    const dx = point.x - last[0];
    const dy = point.y - last[1];
    const distancePx = Math.hypot(dx, dy) * s.view.scale;
    // Interpolate pointer events to keep the spline smooth even when events arrive sparsely.
    const stepPx = 2;
    if (distancePx >= stepPx) {
      const segments = Math.ceil(distancePx / stepPx);
      const additions: Point[] = [];
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        additions.push([last[0] + dx * t, last[1] + dy * t]);
      }
      s.setDraft({ type: 'curve', pts: [...s.draft.pts, ...additions] });
    }
    return true;
  }
  return false;
}

/** Commits or discards one pointer-driven shape draft at pointer release. */
export function finishShapeDraft(s: EditorState): void {
  if (s.draft?.type === 'rect') {
    const { a, b } = s.draft;
    s.setDraft(null);
    if (Math.abs(b.x - a.x) >= 1 && Math.abs(b.y - a.y) >= 1) {
      const shape = { id: createId(), type: 'rect' as const, kind: s.kind, pts: rectPts(a.x, a.y, b.x, b.y) };
      if (s.kind === 'cut') s.cutoutArea(shape);
      else s.addShape(shape);
    }
  }
  if (s.draft?.type === 'circle') {
    const { center, edge } = s.draft;
    s.setDraft(null);
    if (Math.hypot(edge.x - center.x, edge.y - center.y) >= 1) {
      const shape = { id: createId(), type: 'circle' as const, kind: s.kind, pts: [[center.x, center.y], [edge.x, edge.y]] as Point[] };
      if (s.kind === 'cut') s.cutoutArea(shape);
      else s.addShape(shape);
    }
  }
  if (s.draft?.type === 'line') {
    const { a, b } = s.draft;
    s.setDraft(null);
    if (Math.hypot(b.x - a.x, b.y - a.y) >= 1) {
      if (s.kind === 'cut') s.showToast('Cutout works with filled shapes: polygon, rectangle, or circle.');
      else s.addShape({ id: createId(), type: 'line', kind: s.kind, pts: [[a.x, a.y], [b.x, b.y]] });
    }
  }
  if (s.draft?.type === 'curve') {
    const points = s.draft.pts.slice();
    const end = s.rawCursor;
    const last = points[points.length - 1];
    if (end && last && Math.hypot(end.x - last[0], end.y - last[1]) > 0.01) points.push([end.x, end.y]);
    s.setDraft(null);
    if (points.length >= 2) {
      if (s.kind === 'cut') s.showToast('Cutout works with filled shapes: polygon, rectangle, or circle.');
      else s.addShape({ id: createId(), type: 'curve', kind: s.kind, pts: points });
    }
  }
}
