import { nearestPathEdge } from '../../../lib/geometry';
import type { EditorState } from '../../../stores/editorStore';
import type { MapObject, XY } from '../../../types/map';

export const POINT_HIT_PX = 10;

export function nearestPolygonEdge(shapes: MapObject[], point: XY) {
  let nearest: { shape: Extract<MapObject, { type: 'poly' | 'rect' }>; edgeIndex: number; t: number; x: number; y: number; distance: number } | null = null;
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape.hidden || (shape.type !== 'poly' && shape.type !== 'rect')) continue;
    const edge = nearestPathEdge(shape.pts, point, true);
    if (edge && (!nearest || edge.d < nearest.distance)) nearest = { shape, edgeIndex: edge.i, t: edge.t, x: edge.x, y: edge.y, distance: edge.d };
  }
  return nearest;
}

export function handlePointTool(s: EditorState, shapes: MapObject[], point: XY): void {
  const nearest = nearestPolygonEdge(shapes, point);
  if (!nearest || nearest.distance * s.view.scale > POINT_HIT_PX) return;

  const start = nearest.shape.pts[nearest.edgeIndex];
  const end = nearest.shape.pts[(nearest.edgeIndex + 1) % nearest.shape.pts.length];
  const nearEndpoint = Math.min(
    Math.hypot(point.x - start[0], point.y - start[1]),
    Math.hypot(point.x - end[0], point.y - end[1]),
  ) * s.view.scale <= 4;
  if (nearEndpoint) {
    s.select(nearest.shape.id);
    s.showToast('That is already an existing vertex. Click along the edge to add another point.');
  } else {
    s.addPolygonVertex(nearest.shape.id, nearest.edgeIndex, nearest.t, [nearest.x, nearest.y]);
  }
}
