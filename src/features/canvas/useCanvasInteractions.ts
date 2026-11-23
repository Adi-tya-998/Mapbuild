import { useEffect } from 'react';
import type { RefObject } from 'react';
import { nearestEdge, snapValue, HIT_PX } from '../../lib/geometry';
import { findShape, mapShape, useEditorStore } from '../../stores/editorStore';
import type { XY } from '../../types/map';
import { beginEraser, finishBoundaryEraser, moveEraser } from '../eraser';
import { handlePointTool, nearestPolygonEdge, POINT_HIT_PX, beginSelectTool, selectHoverTargetAt, selectionBoxIntersects, updateSelectDrag } from '../selection';
import { beginShapeDrawing, finishShapeDraft, moveShapeDraft } from '../drawing';
import type { Drag } from '../../lib/editorInteraction';

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
      if (e.button === 2 && e.ctrlKey && st().tool === 'select') {
        e.preventDefault();
        host.setPointerCapture(e.pointerId);
        const p = toUnits(e);
        st().select(null);
        st().setMarqueeSelection([]);
        st().setSelectionBox({ a: [p.x, p.y], b: [p.x, p.y] });
        drag = { mode: 'box-select', start: p, end: p };
        return;
      }
      if (e.button !== 0) return;
      host.setPointerCapture(e.pointerId);
      const s = st();
      s.setAlt(e.altKey);
      if (s.tool === 'select') s.setHoverTarget(null);
      const p = toUnits(e);
      const sp = snapPoint(p);
      s.setCursor(sp, p);

      if (s.tool === 'select' && e.ctrlKey) {
        s.select(null);
        s.setMarqueeSelection([]);
        s.setSelectionBox({ a: [p.x, p.y], b: [p.x, p.y] });
        drag = { mode: 'detach-area', start: p, end: p };
        return;
      } else if (s.tool === 'eraser') {
        drag = beginEraser(s, p, e.ctrlKey);
      } else if (s.tool === 'point') {
        handlePointTool(s, s.doc.shapes, p);
      } else if (s.tool === 'select') {
        drag = beginSelectTool(s, p, e, host);
      } else if (beginShapeDrawing(s, s.tool, p, sp)) return;
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

      if (drag?.mode === 'box-select' || drag?.mode === 'detach-area') {
        drag = { ...drag, end: p };
        s.setSelectionBox({ a: [drag.start.x, drag.start.y], b: [p.x, p.y] });
      } else if (drag?.mode === 'erase-area') {
        moveEraser(s, p, drag);
      } else if (drag?.mode === 'erase-boundaries') {
        moveEraser(s, p, drag);
      } else if (drag && (drag.mode === 'move' || drag.mode === 'rotate' || drag.mode === 'vertex')) {
        updateSelectDrag(s, p, sp, drag, snapOpts(), snapValue);
      } else if (moveShapeDraft(s, p, sp)) { /* drawing handler owns draft updates */ }

      if (s.tool === 'select' && !drag) {
        const target = selectHoverTargetAt(s.doc.shapes, p, s.view.scale, s.selectedId);
        s.setHoverTarget(target);
        host.style.cursor = target?.part === 'rotate' ? 'grab' : target?.part === 'vertex' ? 'pointer' : target ? 'move' : 'default';
      } else if (s.tool === 'point' && !drag) {
        s.setHoverTarget(null);
        const edge = nearestPolygonEdge(s.doc.shapes, p);
        host.style.cursor = edge && edge.distance * s.view.scale <= POINT_HIT_PX ? 'copy' : 'crosshair';
      } else if (s.tool !== 'select') {
        s.setHoverTarget(null);
      }
    };

    const endDrag = () => {
      const s = st();
      finishShapeDraft(s);
      if (drag) {
        const finishedDrag = drag;
        const wasPan = finishedDrag.mode === 'pan';
        if (finishedDrag.mode === 'detach-area') {
          const { start, end } = finishedDrag;
          s.setSelectionBox(null);
          drag = null;
          if (Math.hypot(end.x - start.x, end.y - start.y) >= 0.5) {
            s.detachPolygonsInBox([start.x, start.y], [end.x, end.y]);
          }
          return;
        }
        if (finishedDrag.mode === 'box-select') {
          const { start, end } = finishedDrag;
          const ids = Math.hypot(end.x - start.x, end.y - start.y) < 0.5
            ? []
            : s.doc.shapes.filter((shape) => selectionBoxIntersects(shape, start, end)).map((shape) => shape.id);
          s.setSelectionBox(null);
          s.setMarqueeSelection(ids);
          drag = null;
          return;
        }
        if (finishedDrag.mode === 'erase-boundaries') {
          finishBoundaryEraser(s, finishedDrag);
        }
        drag = null;
        if (wasPan || finishedDrag.mode === 'rotate') host.style.cursor = baseCursor();
        if (finishedDrag.mode === 'move' || finishedDrag.mode === 'vertex' || finishedDrag.mode === 'rotate' || finishedDrag.mode === 'erase-boundaries' || (finishedDrag.mode === 'erase-area' && finishedDrag.checkpointed)) s.commit();
      }
    };

    const onPointerLeave = () => {
      st().setHoverTarget(null);
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
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const { viewport } = st();
      const centerX = viewport.w / 2;
      const centerY = viewport.h / 2;
      const zoomX = e.ctrlKey ? e.clientX - host.getBoundingClientRect().left : centerX;
      const zoomY = e.ctrlKey ? e.clientY - host.getBoundingClientRect().top : centerY;
      st().zoomAt(Math.exp(-dy * 0.0015), zoomX, zoomY);
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
