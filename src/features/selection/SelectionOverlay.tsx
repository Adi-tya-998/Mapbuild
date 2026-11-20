import { Fragment } from 'react';
import { Circle, Line, Rect, Text } from 'react-konva';
import { HANDLE_PX, circleRadius, flatten, labelBox, rectPts, rotationHandlePoint } from '../../lib/geometry';
import type { EdgeGap, MapObject, Point } from '../../types/map';
import type { HoverTarget } from '../../stores/editorStore';

const SELECTION_COLOR = '#0aa6b7';

function splitEdge(a: Point, b: Point, gaps: EdgeGap[] = []): Point[][] {
  const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const visible: Point[][] = [];
  let cursor = 0;
  for (const [start, end] of gaps.slice().sort((left, right) => left[0] - right[0])) {
    const lo = Math.max(0, Math.min(1, start));
    const hi = Math.max(lo, Math.min(1, end));
    if (lo > cursor + 1e-5) visible.push([at(cursor), at(lo)]);
    cursor = Math.max(cursor, hi);
  }
  if (cursor < 1 - 1e-5) visible.push([at(cursor), at(1)]);
  return visible;
}

function Outlined({ pts, closed, scale, edgeGaps, edgeOutlines }: { pts: Point[]; closed: boolean; scale: number; edgeGaps?: EdgeGap[][]; edgeOutlines?: Array<'none' | 'white' | 'black' | null | undefined> }) {
  const segments = closed
    ? pts.flatMap((point, i) => edgeOutlines?.[i] === 'none' ? [] : splitEdge(point, pts[(i + 1) % pts.length], edgeGaps?.[i]))
    : [pts];
  return <>{segments.map((segment, i) => <Fragment key={i}>
    <Line points={flatten(segment)} stroke="#ffffff" strokeWidth={3.5 / scale} lineJoin="round" />
    <Line points={flatten(segment)} stroke={SELECTION_COLOR} strokeWidth={1.6 / scale} lineJoin="round" />
  </Fragment>)}</>;
}

function Handle({ p, scale, blue = false }: { p: Point; scale: number; blue?: boolean }) {
  const h = HANDLE_PX / scale;
  if (blue) return <Circle x={p[0]} y={p[1]} radius={h / 2} fill="#00a9e8" stroke="#ffffff" strokeWidth={1.2 / scale} />;
  return <Rect x={p[0] - h / 2} y={p[1] - h / 2} width={h} height={h} fill="#ffffff" stroke={SELECTION_COLOR} strokeWidth={1.6 / scale} />;
}

function RotateHandle({ pts, scale }: { pts: Point[]; scale: number }) {
  if (!pts.length) return null;
  const [x, y] = rotationHandlePoint(pts, scale);
  const topY = Math.min(...pts.map(([, py]) => py));
  const unit = 1 / scale;
  return <>
    <Line points={[x, topY, x, y + 8 * unit]} stroke="#ffffff" strokeWidth={3 * unit} />
    <Line points={[x, topY, x, y + 8 * unit]} stroke={SELECTION_COLOR} strokeWidth={1.2 * unit} />
    <Circle x={x} y={y} radius={8 * unit} fill="#102126" stroke={SELECTION_COLOR} strokeWidth={1.4 * unit} />
    <Text x={x - 7 * unit} y={y - 8 * unit} width={14 * unit} height={16 * unit} text="↻" fontSize={14 * unit} align="center" verticalAlign="middle" fill="#ffffff" listening={false} />
  </>;
}

function SelectionOutline({ shape, scale, selectedEdgeIndex }: { shape: MapObject; scale: number; selectedEdgeIndex: number | null }) {
  if (shape.type === 'label') {
    const box = labelBox(shape);
    return <Outlined pts={rectPts(box.x0, box.y0, box.x1, box.y1)} closed scale={scale} />;
  }
  if (shape.type === 'circle') {
    const radius = circleRadius(shape.pts);
    return <>
      <Circle x={shape.pts[0][0]} y={shape.pts[0][1]} radius={radius} stroke="#ffffff" strokeWidth={3.5 / scale} />
      <Circle x={shape.pts[0][0]} y={shape.pts[0][1]} radius={radius} stroke={selectedEdgeIndex === 0 ? '#ffb020' : SELECTION_COLOR} strokeWidth={1.6 / scale} />
      <Handle p={shape.pts[1]} scale={scale} />
    </>;
  }
  if (shape.type === 'line' || shape.type === 'curve') {
    return <>
      <Line points={flatten(shape.pts)} stroke="#ffffff" strokeWidth={3.5 / scale} lineCap="round" lineJoin="round" tension={shape.type === 'curve' ? 0.5 : 0} />
      <Line points={flatten(shape.pts)} stroke={selectedEdgeIndex === 0 ? '#ffb020' : SELECTION_COLOR} strokeWidth={1.6 / scale} lineCap="round" lineJoin="round" tension={shape.type === 'curve' ? 0.5 : 0} />
      {shape.pts.map((point, i) => <Handle key={i} p={point} scale={scale} />)}
      <RotateHandle pts={shape.pts} scale={scale} />
    </>;
  }
  return <>
    <Outlined pts={shape.pts} closed scale={scale} edgeGaps={shape.edgeGaps} edgeOutlines={shape.edgeOutlines} />
    {selectedEdgeIndex !== null && shape.edgeOutlines?.[selectedEdgeIndex] !== 'none' && shape.pts[selectedEdgeIndex] && shape.pts[(selectedEdgeIndex + 1) % shape.pts.length] && splitEdge(shape.pts[selectedEdgeIndex], shape.pts[(selectedEdgeIndex + 1) % shape.pts.length], shape.edgeGaps?.[selectedEdgeIndex]).map((segment, i) => <Line key={i} points={flatten(segment)} stroke="#ffb020" strokeWidth={2.5 / scale} lineCap="butt" />)}
    {shape.holes?.map((ring, ringIndex) => <Outlined key={`hole-${ringIndex}`} pts={ring} closed scale={scale} />)}
    {shape.pts.map((point, i) => <Handle key={i} p={point} scale={scale} blue={shape.detached} />)}
    {shape.detached && shape.holes?.flatMap((ring, ringIndex) => ring.map((point, i) => <Handle key={`hole-${ringIndex}-${i}`} p={point} scale={scale} blue />))}
    <RotateHandle pts={shape.pts} scale={scale} />
  </>;
}

function HoverHighlight({ shape, target, scale }: { shape: MapObject; target: HoverTarget; scale: number }) {
  const strokeWidth = 3 / scale;
  if (target.part === 'vertex') {
    const ring = target.ring ?? 0;
    const point = ring === 0 ? shape.pts[target.index ?? -1] : (shape.type === 'poly' || shape.type === 'rect' ? shape.holes?.[ring - 1]?.[target.index ?? -1] : undefined);
    if (!point) return null;
    return <Circle x={point[0]} y={point[1]} radius={7 / scale} fill="#ffb020" stroke="#ffffff" strokeWidth={1.5 / scale} />;
  }
  if (target.part === 'rotate') {
    const [x, y] = rotationHandlePoint(shape.pts, scale);
    return <Circle x={x} y={y} radius={10 / scale} stroke="#ffb020" strokeWidth={2 / scale} />;
  }
  if (target.part === 'body') {
    if (shape.type === 'label') {
      const box = labelBox(shape);
      return <Rect x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} fill="rgba(10,166,183,.16)" stroke={SELECTION_COLOR} strokeWidth={strokeWidth} />;
    }
    if (shape.type === 'circle') return <Circle x={shape.pts[0][0]} y={shape.pts[0][1]} radius={circleRadius(shape.pts)} fill="rgba(10,166,183,.16)" stroke={SELECTION_COLOR} strokeWidth={strokeWidth} />;
    if (shape.type === 'poly' || shape.type === 'rect') return <Line points={flatten(shape.pts)} closed stroke={SELECTION_COLOR} strokeWidth={strokeWidth} lineJoin="round" />;
  }
  if (shape.type === 'circle') return <>
    <Circle x={shape.pts[0][0]} y={shape.pts[0][1]} radius={circleRadius(shape.pts)} stroke="#ffffff" strokeWidth={5 / scale} />
    <Circle x={shape.pts[0][0]} y={shape.pts[0][1]} radius={circleRadius(shape.pts)} stroke="#ffb020" strokeWidth={strokeWidth} />
  </>;
  if (shape.type === 'line' || shape.type === 'curve') return <>
    <Line points={flatten(shape.pts)} stroke="#ffffff" strokeWidth={5 / scale} lineCap="round" lineJoin="round" tension={shape.type === 'curve' ? 0.5 : 0} />
    <Line points={flatten(shape.pts)} stroke="#ffb020" strokeWidth={strokeWidth} lineCap="round" lineJoin="round" tension={shape.type === 'curve' ? 0.5 : 0} />
  </>;
  if (shape.type === 'poly' || shape.type === 'rect') {
    const ring = target.ring ?? 0;
    const points = ring === 0 ? shape.pts : shape.holes?.[ring - 1];
    const index = target.index ?? -1;
    if (!points?.length || index < 0 || index >= points.length) return null;
    const segment: Point[] = [points[index], points[(index + 1) % points.length]];
    return <>
      <Line points={flatten(segment)} stroke="#ffffff" strokeWidth={5 / scale} lineCap="round" />
      <Line points={flatten(segment)} stroke="#ffb020" strokeWidth={strokeWidth} lineCap="round" />
    </>;
  }
  return null;
}

export interface SelectionOverlayProps {
  selected: MapObject | null;
  hoverShape: MapObject | null;
  hoverTarget: HoverTarget | null;
  multiSelected?: MapObject[];
  selectionBox?: { a: Point; b: Point } | null;
  scale: number;
  selectedEdgeIndex: number | null;
}

export function SelectionOverlay({ selected, hoverShape, hoverTarget, multiSelected = [], selectionBox, scale, selectedEdgeIndex }: SelectionOverlayProps) {
  return <>
    {selected && !selected.hidden && <SelectionOutline shape={selected} scale={scale} selectedEdgeIndex={selectedEdgeIndex} />}
    {multiSelected.map((shape) => <SelectionOutline key={shape.id} shape={shape} scale={scale} selectedEdgeIndex={null} />)}
    {hoverTarget && hoverShape && !hoverShape.hidden && <HoverHighlight shape={hoverShape} target={hoverTarget} scale={scale} />}
    {selectionBox && <Rect
      x={Math.min(selectionBox.a[0], selectionBox.b[0])}
      y={Math.min(selectionBox.a[1], selectionBox.b[1])}
      width={Math.abs(selectionBox.b[0] - selectionBox.a[0])}
      height={Math.abs(selectionBox.b[1] - selectionBox.a[1])}
      fill="rgba(10,166,183,.13)"
      stroke={SELECTION_COLOR}
      strokeWidth={1 / scale}
      dash={[4 / scale, 3 / scale]}
    />}
  </>;
}
