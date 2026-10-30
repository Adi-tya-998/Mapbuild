import { useEffect } from 'react';
import type { RefObject } from 'react';
import { circleRadius, hitTest, hitVertex, moveRectCorner, nearestEdge, nearestPathEdge, rectPts, snapValue, HIT_PX } from '../../lib/geometry';
import { createId } from '../../lib/id';
import { findShape, mapShape, useEditorStore } from '../../stores/editorStore';
import type { MapObject, Point, XY } from '../../types/map';

const ERASER_HIT_PX = 8;
const POINT_HIT_PX = 10;

type PolygonEdgeHit = {
  shape: Extract<MapObject, { type: 'poly' | 'rect' }>;
  edgeIndex: number;
  t: number;
  point: Point;
  distance: number;
};

function nearestPolygonEdge(shapes: MapObject[], p: XY): PolygonEdgeHit | null {
  let nearest: PolygonEdgeHit | null = null;
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape.hidden || (shape.type !== 'poly' && shape.type !== 'rect')) continue;
    const edge = nearestPathEdge(shape.pts, p, true);
    if (edge && (!nearest || edge.d < nearest.distance)) {
      nearest = { shape, edgeIndex: edge.i, t: edge.t, point: [edge.x, edge.y], distance: edge.d };
    }
  }
  return nearest;
}

function nearestBoundary(shape: MapObject, p: XY): { distance: number; point: Point; edgeIndex?: number; t?: number } | null {
  if (shape.type === 'label') return null;
  if (shape.type === 'circle') {
    if ((shape.edgeOutlines?.[0] ?? shape.outline) === 'none') return null;
    const dx = p.x - shape.pts[0][0];
    const dy = p.y - shape.pts[0][1];
    const radius = circleRadius(shape.pts);
    const distanceFromCenter = Math.hypot(dx, dy);
    const directionX = distanceFromCenter === 0 ? 1 : dx / distanceFromCenter;
    const directionY = distanceFromCenter === 0 ? 0 : dy / distanceFromCenter;
    return { distance: Math.abs(distanceFromCenter - radius), point: [shape.pts[0][0] + directionX * radius, shape.pts[0][1] + directionY * radius] };
  }
  if (shape.type === 'poly' || shape.type === 'rect') {
    let best: { distance: number; point: Point; edgeIndex: number; t: number } | null = null;
    for (let i = 0; i < shape.pts.length; i++) {
      if ((shape.edgeOutlines?.[i] ?? shape.outline) === 'none') continue;
      const hit = nearestPathEdge([shape.pts[i], shape.pts[(i + 1) % shape.pts.length]], p, false);
      if (hit && (!best || hit.d < best.distance)) best = { distance: hit.d, point: [hit.x, hit.y], edgeIndex: i, t: hit.t };
    }
    return best;
  }
  if ((shape.edgeOutlines?.[0] ?? shape.outline) === 'none') return null;
  const hit = nearestPathEdge(shape.pts, p, false);
  return hit ? { distance: hit.d, point: [hit.x, hit.y], t: hit.t } : null;
}

type Drag =
  | { mode: 'pan'; x: number; y: number }
  | { mode: 'move'; start: XY; members: Array<{ id: string; pts: Point[] }> }
  | { mode: 'erase'; id: string; activePath: boolean; edgeIndex?: number; lastT?: number }
  | { mode: 'vertex'; id: string; index: number };

/**
 * Pointer interactions for the map sheet: drawing, selecting, moving, vertex editing, panning and zooming.
 * Listeners are native (not Konva events) so pointer capture works and handlers always read fresh store state.
 * Coordinates are converted to map units through the current view transform, so objects never depend on window size.
 */
export function useCanvasInteractions(hostRef: RefObject<HTMLDivElement>): void {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const st = useEditorStore.getState;
    let drag: Drag | null = null;

    const baseCursor = () => (st().tool === 'select' ? 'default' : 'crosshair');
    host.style.cursor = baseCursor();

    const toUnits = (e: { clientX: number; clientY: number }): XY => {
      const r = host.getBoundingClientRect();
      const { view } = st();
      return { x: (e.clientX - r.left - view.x) / view.scale, y: (e.clientY - r.top - view.y) / view.scale };
    };
    const snapOpts = () => {
      const s = st();
      return { snap: s.snap, alt: s.altKey, gridSize: s.gridSize };
    };
    const snapPoint = (p: XY): XY => {
      const o = snapOpts();
      return { x: snapValue(p.x, o), y: snapValue(p.y, o) };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-canvas-tool-menu]')) return;
      // Pan: middle button, or left button while Space is held.
      if (e.button === 1 || (e.button === 0 && st().spaceHeld)) {
        e.preventDefault();
        host.setPointerCapture(e.pointerId);
        drag = { mode: 'pan', x: e.clientX, y: e.clientY };
        host.style.cursor = 'grabbing';
        return;
      }
      if (e.button !== 0) return;
      host.setPointerCapture(e.pointerId);
      const s = st();
      s.setAlt(e.altKey);
      const p = toUnits(e);
      const sp = snapPoint(p);
      s.setCursor(sp, p);

      if (s.tool === 'eraser') {
        let nearest: { shape: MapObject; point: Point; distance: number; edgeIndex?: number; t?: number } | null = null;
        for (let i = s.doc.shapes.length - 1; i >= 0; i--) {
          const shape = s.doc.shapes[i];
          if (shape.hidden) continue;
          const edge = nearestBoundary(shape, p);
          if (edge && edge.distance * s.view.scale <= ERASER_HIT_PX && (!nearest || edge.distance < nearest.distance)) {
            nearest = { shape, point: edge.point, distance: edge.distance, edgeIndex: edge.edgeIndex, t: edge.t };
          }
        }
        if (nearest) {
          s.select(nearest.shape.id);
          s.checkpoint();
          if ((nearest.shape.type === 'poly' || nearest.shape.type === 'rect') && nearest.edgeIndex !== undefined && nearest.t !== undefined) {
            s.addPolygonEdgeGap(nearest.shape.id, nearest.edgeIndex, nearest.t);
          } else {
            s.addErasurePoint(nearest.shape.id, nearest.point, true);
          }
          drag = { mode: 'erase', id: nearest.shape.id, activePath: true, edgeIndex: nearest.edgeIndex, lastT: nearest.t };
        }
      } else if (s.tool === 'point') {
        const edge = nearestPolygonEdge(s.doc.shapes, p);
        if (edge && edge.distance * s.view.scale <= POINT_HIT_PX) {
          const start = edge.shape.pts[edge.edgeIndex];
          const end = edge.shape.pts[(edge.edgeIndex + 1) % edge.shape.pts.length];
          const nearEndpoint = Math.min(
            Math.hypot(p.x - start[0], p.y - start[1]),
            Math.hypot(p.x - end[0], p.y - end[1]),
          ) * s.view.scale <= 4;
          if (nearEndpoint) {
            s.select(edge.shape.id);
            s.showToast('That is already an existing vertex. Click along the edge to add another point.');
          } else {
            s.addPolygonVertex(edge.shape.id, edge.edgeIndex, edge.t, edge.point);
          }
        }
      } else if (s.tool === 'select') {
        const sel = findShape(s.doc.shapes, s.selectedId);
        if (sel && !sel.hidden && sel.type !== 'label') {
          const vi = hitVertex(sel, p, s.view.scale);
          if (vi >= 0) {
            if (e.shiftKey && sel.type !== 'rect' && sel.pts.length > 3) {
              s.act((doc) => mapShape(doc, sel.id, (o) => ({ ...o, pts: o.pts.filter((_, i) => i !== vi) })));
              return;
            }
            s.checkpoint();
            drag = { mode: 'vertex', id: sel.id, index: vi };
            return;
          }
        }
        const hit = hitTest(s.doc.shapes, p, s.view.scale);
        if (hit) {
          s.select(hit.id);
          if (hit.type !== 'label') {
            let edgeIndex: number | null = null;
            let distance = Infinity;
            if (hit.type === 'circle') {
              distance = Math.abs(Math.hypot(p.x - hit.pts[0][0], p.y - hit.pts[0][1]) - circleRadius(hit.pts));
              if (distance * s.view.scale <= HIT_PX) edgeIndex = 0;
            } else {
              const edge = nearestPathEdge(hit.pts, p, hit.type === 'poly' || hit.type === 'rect');
              if (edge) {
                distance = edge.d;
                if (distance * s.view.scale <= HIT_PX) edgeIndex = hit.type === 'line' || hit.type === 'curve' ? 0 : edge.i;
              }
            }
            if (edgeIndex !== null) s.selectEdge(edgeIndex);
          }
          s.checkpoint();
          const members = hit.groupId ? s.doc.shapes.filter((shape) => shape.groupId === hit.groupId) : [hit];
          drag = { mode: 'move', start: p, members: members.map((shape) => ({ id: shape.id, pts: shape.pts.map((q) => [q[0], q[1]] as Point) })) };
        } else {
          s.select(null);
        }
      } else if (s.tool === 'rect') {
        s.setDraft({ type: 'rect', a: sp, b: sp });
      } else if (s.tool === 'circle') {
        s.setDraft({ type: 'circle', center: sp, edge: sp });
      } else if (s.tool === 'line') {
        s.setDraft({ type: 'line', a: sp, b: sp });
      } else if (s.tool === 'curve') {
        // Curves follow the pointer directly; grid snapping creates visible stair steps.
        s.setDraft({ type: 'curve', pts: [[p.x, p.y]] });
      } else if (s.tool === 'poly') {
        const d = s.draft;
        if (!d || d.type !== 'poly') {
          s.setDraft({ type: 'poly', pts: [[sp.x, sp.y]] });
          return;
        }
        const first = d.pts[0];
        const last = d.pts[d.pts.length - 1];
        const nearFirst = d.pts.length >= 3 && Math.hypot(p.x - first[0], p.y - first[1]) * s.view.scale <= HIT_PX;
        const same = Math.abs(sp.x - last[0]) < 1e-6 && Math.abs(sp.y - last[1]) < 1e-6;
        if (nearFirst || (same && d.pts.length >= 3)) {
          s.finishPolygon();
          return;
        }
        if (!same) s.setDraft({ type: 'poly', pts: [...d.pts, [sp.x, sp.y]] });
      } else if (s.tool === 'label') {
        s.addShape({ id: createId(), type: 'label', pts: [[sp.x, sp.y]], text: 'Label', size: 12, tone: 'light' });
        s.setTool('select');
        // Wait for the properties panel to render the new label's text field, then focus it.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const input = document.getElementById('label-text') as HTMLInputElement | null;
            input?.focus();
            input?.select();
          }),
        );
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (drag?.mode === 'pan') {
        st().panBy(e.clientX - drag.x, e.clientY - drag.y);
        drag = { mode: 'pan', x: e.clientX, y: e.clientY };
        return;
      }
      const s = st();
      s.setAlt(e.altKey);
      const p = toUnits(e);
      const sp = snapPoint(p);
      s.setCursor(sp, p);

      if (drag?.mode === 'erase') {
        const d = drag;
        const shape = findShape(s.doc.shapes, d.id);
        const edge = shape ? nearestBoundary(shape, p) : null;
        const onBoundary = edge !== null && edge.distance * s.view.scale <= ERASER_HIT_PX;
        if (onBoundary && edge) {
          if (edge.edgeIndex !== undefined && edge.t !== undefined) {
            const continueSameEdge = d.activePath && d.edgeIndex === edge.edgeIndex;
            s.addPolygonEdgeGap(d.id, edge.edgeIndex, edge.t, continueSameEdge ? d.lastT : undefined);
            drag = { ...d, activePath: true, edgeIndex: edge.edgeIndex, lastT: edge.t };
          } else {
            s.addErasurePoint(d.id, edge.point, !d.activePath);
            drag = { ...d, activePath: true, edgeIndex: undefined, lastT: undefined };
          }
        } else if (d.activePath) {
          drag = { ...d, activePath: false };
        }
      } else if (drag?.mode === 'move') {
        const d = drag;
        const f = d.members.find((member) => member.id === s.selectedId)?.pts[0] ?? d.members[0]?.pts[0];
        if (!f) return;
        const rx = p.x - d.start.x;
        const ry = p.y - d.start.y;
        const o = snapOpts();
        const dx = o.snap && !o.alt ? snapValue(f[0] + rx, o) - f[0] : Math.round(rx * 10) / 10;
        const dy = o.snap && !o.alt ? snapValue(f[1] + ry, o) - f[1] : Math.round(ry * 10) / 10;
        const originals = new Map(d.members.map((member) => [member.id, member.pts]));
        s.liveEdit((doc) => ({ ...doc, shapes: doc.shapes.map((shape) => {
          const pts = originals.get(shape.id);
          return pts ? { ...shape, pts: pts.map(([x, y]) => [x + dx, y + dy] as Point) } : shape;
        }) }));
      } else if (drag?.mode === 'vertex') {
        const d = drag;
        s.liveEdit((doc) =>
          mapShape(doc, d.id, (sh) => {
            if (sh.type === 'rect') return { ...sh, pts: moveRectCorner(sh.pts, d.index, sp) };
            return { ...sh, pts: sh.pts.map((q, i) => (i === d.index ? ([sp.x, sp.y] as Point) : q)) };
          }),
        );
      } else if (s.draft?.type === 'rect') {
        s.setDraft({ type: 'rect', a: s.draft.a, b: sp });
      } else if (s.draft?.type === 'circle') {
        s.setDraft({ type: 'circle', center: s.draft.center, edge: sp });
      } else if (s.draft?.type === 'line') {
        s.setDraft({ type: 'line', a: s.draft.a, b: sp });
      } else if (s.draft?.type === 'curve') {
        const last = s.draft.pts[s.draft.pts.length - 1];
        const dx = p.x - last[0];
        const dy = p.y - last[1];
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
      }

      if (s.tool === 'select' && !drag) {
        const sel = findShape(s.doc.shapes, s.selectedId);
        const overHandle = !!sel && sel.type !== 'label' && hitVertex(sel, p, s.view.scale) >= 0;
        host.style.cursor = overHandle ? 'pointer' : hitTest(s.doc.shapes, p, s.view.scale) ? 'move' : 'default';
      } else if (s.tool === 'point' && !drag) {
        const edge = nearestPolygonEdge(s.doc.shapes, p);
        host.style.cursor = edge && edge.distance * s.view.scale <= POINT_HIT_PX ? 'copy' : 'crosshair';
      }
    };

    const endDrag = () => {
      const s = st();
      if (s.draft?.type === 'rect') {
        const { a, b } = s.draft;
        s.setDraft(null);
        if (Math.abs(b.x - a.x) >= 1 && Math.abs(b.y - a.y) >= 1) {
          s.addShape({ id: createId(), type: 'rect', kind: s.kind, pts: rectPts(a.x, a.y, b.x, b.y) });
        }
      }
      if (s.draft?.type === 'circle') {
        const { center, edge } = s.draft;
        s.setDraft(null);
        if (Math.hypot(edge.x - center.x, edge.y - center.y) >= 1) {
          s.addShape({ id: createId(), type: 'circle', kind: s.kind, pts: [[center.x, center.y], [edge.x, edge.y]] });
        }
      }
      if (s.draft?.type === 'line') {
        const { a, b } = s.draft;
        s.setDraft(null);
        if (Math.hypot(b.x - a.x, b.y - a.y) >= 1) {
          s.addShape({ id: createId(), type: 'line', kind: s.kind, pts: [[a.x, a.y], [b.x, b.y]] });
        }
      }
      if (s.draft?.type === 'curve') {
        const pts = s.draft.pts.slice();
        const end = s.rawCursor;
        const last = pts[pts.length - 1];
        if (end && last && Math.hypot(end.x - last[0], end.y - last[1]) > 0.01) pts.push([end.x, end.y]);
        s.setDraft(null);
        if (pts.length >= 2) s.addShape({ id: createId(), type: 'curve', kind: s.kind, pts });
      }
      if (drag) {
        const finishedDrag = drag;
        const wasPan = finishedDrag.mode === 'pan';
        if (finishedDrag.mode === 'erase') s.finalizePolygonEdgeGaps(finishedDrag.id);
        drag = null;
        if (wasPan) host.style.cursor = baseCursor();
        else s.commit();
      }
    };

    const onPointerLeave = () => {
      if (!drag) st().setCursor(null, null);
    };

    const onDoubleClick = (e: MouseEvent) => {
      const s = st();
      if (s.tool !== 'select') return;
      const sel = findShape(s.doc.shapes, s.selectedId);
      if (!sel || sel.type !== 'poly') return; // rectangles keep exactly four corners
      const best = nearestEdge(sel.pts, toUnits(e));
      if (best && best.d * s.view.scale <= HIT_PX) {
        const at = snapPoint({ x: best.x, y: best.y });
        s.act((doc) =>
          mapShape(doc, sel.id, (o) => {
            const pts = o.pts.slice();
            pts.splice(best.i + 1, 0, [at.x, at.y]);
            return { ...o, pts };
          }),
        );
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = host.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      st().zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);
    host.addEventListener('pointerleave', onPointerLeave);
    host.addEventListener('dblclick', onDoubleClick);
    host.addEventListener('wheel', onWheel, { passive: false });
    const unsubscribe = useEditorStore.subscribe((s, prev) => {
      if (s.tool !== prev.tool && !drag) host.style.cursor = baseCursor();
    });

    return () => {
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', endDrag);
      host.removeEventListener('pointercancel', endDrag);
      host.removeEventListener('pointerleave', onPointerLeave);
      host.removeEventListener('dblclick', onDoubleClick);
      host.removeEventListener('wheel', onWheel);
      unsubscribe();
    };
  }, [hostRef]);
}
