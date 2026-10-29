import { Fragment, memo } from 'react';
import { Circle, Image as KonvaImage, Line, Rect, Shape, Text } from 'react-konva';
import { LABEL_FONT, HANDLE_PX, circleRadius, flatten, labelBox, rectPts } from '../../lib/geometry';
import { containRect } from '../../lib/image';
import { DEFAULT_OUTLINE_WIDTH, ERASER_WIDTH, elevationFill, SHEET_SIZE, SURFACES } from '../../types/map';
import type { Draft, EdgeGap, LabelObject, MapObject, Point, SurfaceKind, XY } from '../../types/map';
import type { Background } from '../../types/project';

export const SELECTION_COLOR = '#0aa6b7';

/** Split one polygon edge into the portions that remain visible after normalized outline gaps. */
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

// ---------- document content (what ends up in the exported PNG) ----------

function LabelNode({ s }: { s: LabelObject }) {
  const b = labelBox(s);
  const dark = s.tone === 'dark';
  const outlineColor = s.outline === 'white' ? '#ffffff' : s.outline === 'black' ? '#1d1d1d' : s.outline === 'none' ? undefined : dark ? 'rgba(255,255,255,.75)' : 'rgba(30,30,30,.55)';
  return (
    <Text
      x={b.x0}
      y={b.y0}
      width={b.x1 - b.x0}
      height={b.y1 - b.y0}
      text={s.text}
      fontFamily={LABEL_FONT}
      fontStyle="600"
      fontSize={s.size}
      align="center"
      verticalAlign="middle"
      wrap="none"
      fill={dark ? '#1d1d1d' : '#ffffff'}
      stroke={outlineColor}
      strokeWidth={outlineColor ? (s.outlineWidth ?? DEFAULT_OUTLINE_WIDTH) : 0}
      fillAfterStrokeEnabled
      lineJoin="round"
    />
  );
}

interface ShapesProps {
  shapes: MapObject[];
  /** Bumped when web fonts finish loading so label boxes are measured again. */
  fontTick: number;
}

export const SheetShapes = memo(function SheetShapes({ shapes }: ShapesProps) {
  return (
    <>
      {shapes.map((s) => {
        if (s.hidden) return null;
        if (s.type === 'label') return <LabelNode key={s.id} s={s} />;
        const fill = elevationFill(s.kind, s.elevation);
        const outlineFor = (index: number, fallback: 'none' | 'white' | 'black') => s.edgeOutlines?.[index] ?? s.outline ?? fallback;
        const widthFor = (index: number) => s.edgeWidths?.[index] ?? s.outlineWidth ?? DEFAULT_OUTLINE_WIDTH;
        if (s.type === 'circle') {
          const outline = outlineFor(0, 'none');
          const outlineWidth = widthFor(0);
          return <Fragment key={s.id}>
            <Circle x={s.pts[0][0]} y={s.pts[0][1]} radius={circleRadius(s.pts)} fill={fill} stroke={outline === 'white' ? '#ffffff' : outline === 'black' ? '#1d1d1d' : (s.outline === undefined && s.edgeOutlines?.[0] === undefined ? fill : undefined)} strokeWidth={outline === 'white' || outline === 'black' ? outlineWidth : outline === 'none' ? (s.outline === undefined && s.edgeOutlines?.[0] === undefined ? 0.35 : 0) : 0} perfectDrawEnabled={false} />
            <SurfaceErasures erasures={s.erasures} kind={s.kind} fill={fill} />
          </Fragment>;
        }
        if (s.type === 'line' || s.type === 'curve') {
          const points = flatten(s.pts);
          const outline = outlineFor(0, 'white');
          const outlineWidth = widthFor(0);
          if (outline === 'none') return <SurfaceErasures key={s.id} erasures={s.erasures} kind={s.kind} />;
          if (outline === 'black') return <Fragment key={s.id}><Line points={points} stroke="#1d1d1d" strokeWidth={outlineWidth} lineCap="round" lineJoin="round" tension={s.type === 'curve' ? 0.5 : 0} perfectDrawEnabled={false} /><SurfaceErasures erasures={s.erasures} kind={s.kind} /></Fragment>;
          return (
            <Fragment key={s.id}>
              <Line points={points} stroke="rgba(25,35,38,.8)" strokeWidth={outlineWidth + 0.8} lineCap="round" lineJoin="round" tension={s.type === 'curve' ? 0.5 : 0} perfectDrawEnabled={false} />
              <Line points={points} stroke="#ffffff" strokeWidth={outlineWidth} lineCap="round" lineJoin="round" tension={s.type === 'curve' ? 0.5 : 0} perfectDrawEnabled={false} />
              <SurfaceErasures erasures={s.erasures} kind={s.kind} />
            </Fragment>
          );
        }
        return <Fragment key={s.id}>
          <Line points={flatten(s.pts)} closed fill={fill} perfectDrawEnabled={false} />
          {s.pts.map((p, i) => {
            const q = s.pts[(i + 1) % s.pts.length];
            const outline = s.edgeOutlines?.[i] ?? s.outline;
            if (outline === 'none') return null;
            const stroke = outline === 'white' ? '#ffffff' : outline === 'black' ? '#1d1d1d' : fill;
            const outlineWidth = s.edgeWidths?.[i] ?? s.outlineWidth ?? DEFAULT_OUTLINE_WIDTH;
            return <Fragment key={i}>{splitEdge(p, q, s.edgeGaps?.[i]).map((segment, j) => (
              <Line key={j} points={flatten(segment)} stroke={stroke} strokeWidth={outline === 'white' || outline === 'black' ? outlineWidth : 0.35} lineCap="butt" perfectDrawEnabled={false} />
            ))}</Fragment>;
          })}
          <SurfaceErasures erasures={s.erasures} kind={s.kind} fill={fill} />
        </Fragment>;
      })}
    </>
  );
});

function SurfaceErasures({ erasures, kind, fill = SURFACES[kind].fill }: { erasures: Point[][] | undefined; kind: SurfaceKind; fill?: string }) {
  if (!erasures?.length) return null;
  return <>
    {erasures.map((stroke, i) => stroke.length === 1
      ? <Circle key={i} x={stroke[0][0]} y={stroke[0][1]} radius={ERASER_WIDTH / 2} fill={fill} />
      : stroke.length > 1 && <Line key={i} points={flatten(stroke)} stroke={fill} strokeWidth={ERASER_WIDTH} lineCap="round" lineJoin="round" perfectDrawEnabled={false} />)}
  </>;
}

export function BackgroundImage({ image, background }: { image: HTMLImageElement | null; background: Background | null }) {
  if (!image || !background || !background.visible) return null;
  const r = containRect(image.naturalWidth, image.naturalHeight, SHEET_SIZE);
  return <KonvaImage image={image} x={r.x} y={r.y} width={r.width} height={r.height} opacity={background.opacity} />;
}

// ---------- editor-only layers ----------

function GridPass({ values, stroke, strokeWidth }: { values: number[]; stroke: string; strokeWidth: number }) {
  if (!values.length) return null;
  return (
    <Shape
      stroke={stroke}
      strokeWidth={strokeWidth}
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        for (const v of values) {
          ctx.moveTo(v, 0);
          ctx.lineTo(v, SHEET_SIZE);
          ctx.moveTo(0, v);
          ctx.lineTo(SHEET_SIZE, v);
        }
        ctx.strokeShape(shape);
      }}
    />
  );
}

export function GridLines({ gridSize, scale }: { gridSize: number; scale: number }) {
  const majorStep = gridSize >= 10 ? 50 : 10;
  const minor: number[] = [];
  const major: number[] = [];
  for (let v = 0; v <= SHEET_SIZE + 0.001; v += gridSize) {
    const m = v % majorStep;
    if (Math.abs(m) < 0.001 || Math.abs(m - majorStep) < 0.001) major.push(v);
    else if (gridSize * scale >= 3) minor.push(v); // hide minor lines when they would be too dense
  }
  return (
    <>
      <GridPass values={minor} stroke="rgba(32,105,145,.24)" strokeWidth={1 / scale} />
      <GridPass values={major} stroke="rgba(24,87,125,.48)" strokeWidth={1 / scale} />
    </>
  );
}

function Outlined({ pts, closed, scale, edgeGaps, edgeOutlines }: { pts: Point[]; closed: boolean; scale: number; edgeGaps?: EdgeGap[][]; edgeOutlines?: Array<'none' | 'white' | 'black' | null | undefined> }) {
  const segments = closed
    ? pts.flatMap((p, i) => edgeOutlines?.[i] === 'none' ? [] : splitEdge(p, pts[(i + 1) % pts.length], edgeGaps?.[i]))
    : [pts];
  return (
    <>
      {segments.map((segment, i) => <Fragment key={i}>
        <Line points={flatten(segment)} stroke="#ffffff" strokeWidth={3.5 / scale} lineJoin="round" />
        <Line points={flatten(segment)} stroke={SELECTION_COLOR} strokeWidth={1.6 / scale} lineJoin="round" />
      </Fragment>)}
    </>
  );
}

function Handle({ p, scale }: { p: Point; scale: number }) {
  const h = HANDLE_PX / scale;
  return (
    <Rect
      x={p[0] - h / 2}
      y={p[1] - h / 2}
      width={h}
      height={h}
      fill="#ffffff"
      stroke={SELECTION_COLOR}
      strokeWidth={1.6 / scale}
    />
  );
}

function SelectionOutline({ shape, scale, selectedEdgeIndex }: { shape: MapObject; scale: number; selectedEdgeIndex: number | null }) {
  if (shape.type === 'label') {
    const b = labelBox(shape);
    return <Outlined pts={rectPts(b.x0, b.y0, b.x1, b.y1)} closed scale={scale} />;
  }
  if (shape.type === 'circle') {
    const radius = circleRadius(shape.pts);
    return (
      <>
        <Circle x={shape.pts[0][0]} y={shape.pts[0][1]} radius={radius} stroke="#ffffff" strokeWidth={3.5 / scale} />
        <Circle x={shape.pts[0][0]} y={shape.pts[0][1]} radius={radius} stroke={selectedEdgeIndex === 0 ? '#ffb020' : SELECTION_COLOR} strokeWidth={1.6 / scale} />
        <Handle p={shape.pts[1]} scale={scale} />
      </>
    );
  }
  if (shape.type === 'line' || shape.type === 'curve') {
    return (
      <>
        <Line points={flatten(shape.pts)} stroke="#ffffff" strokeWidth={3.5 / scale} lineCap="round" lineJoin="round" tension={shape.type === 'curve' ? 0.5 : 0} />
        <Line points={flatten(shape.pts)} stroke={selectedEdgeIndex === 0 ? '#ffb020' : SELECTION_COLOR} strokeWidth={1.6 / scale} lineCap="round" lineJoin="round" tension={shape.type === 'curve' ? 0.5 : 0} />
        {shape.pts.map((p, i) => <Handle key={i} p={p} scale={scale} />)}
      </>
    );
  }
  return (
    <>
      <Outlined pts={shape.pts} closed scale={scale} edgeGaps={shape.edgeGaps} edgeOutlines={shape.edgeOutlines} />
      {selectedEdgeIndex !== null && shape.edgeOutlines?.[selectedEdgeIndex] !== 'none' && shape.pts[selectedEdgeIndex] && shape.pts[(selectedEdgeIndex + 1) % shape.pts.length] && splitEdge(shape.pts[selectedEdgeIndex], shape.pts[(selectedEdgeIndex + 1) % shape.pts.length], shape.edgeGaps?.[selectedEdgeIndex]).map((segment, i) => <Line key={i} points={flatten(segment)} stroke="#ffb020" strokeWidth={2.5 / scale} lineCap="butt" />)}
      {shape.pts.map((p, i) => (
        <Handle key={i} p={p} scale={scale} />
      ))}
    </>
  );
}

function DraftPreview({
  draft,
  cursor,
  rawCursor,
  kind,
  scale,
}: {
  draft: Draft;
  cursor: XY | null;
  rawCursor: XY | null;
  kind: SurfaceKind;
  scale: number;
}) {
  const fill = SURFACES[kind].fill;
  if (draft.type === 'rect') {
    const pts = rectPts(draft.a.x, draft.a.y, draft.b.x, draft.b.y);
    return (
      <>
        <Line points={flatten(pts)} closed fill={fill} opacity={0.45} />
        <Outlined pts={pts} closed scale={scale} />
      </>
    );
  }
  if (draft.type === 'circle') {
    const radius = Math.hypot(draft.edge.x - draft.center.x, draft.edge.y - draft.center.y);
    return (
      <>
        <Circle x={draft.center.x} y={draft.center.y} radius={radius} fill={fill} opacity={0.45} />
        <Circle x={draft.center.x} y={draft.center.y} radius={radius} stroke="#ffffff" strokeWidth={3.5 / scale} />
        <Circle x={draft.center.x} y={draft.center.y} radius={radius} stroke={SELECTION_COLOR} strokeWidth={1.6 / scale} />
      </>
    );
  }
  if (draft.type === 'line') {
    const pts: Point[] = [[draft.a.x, draft.a.y], [cursor?.x ?? draft.b.x, cursor?.y ?? draft.b.y]];
    return <Outlined pts={pts} closed={false} scale={scale} />;
  }
  if (draft.type === 'curve') {
    const previewCursor = rawCursor ?? cursor;
    const pts = previewCursor ? [...draft.pts, [previewCursor.x, previewCursor.y] as Point] : draft.pts;
    return <Line points={flatten(pts)} stroke="#ffffff" strokeWidth={3.5 / scale} lineCap="round" lineJoin="round" tension={0.5} />;
  }
  const pts: Point[] = cursor ? [...draft.pts, [cursor.x, cursor.y]] : draft.pts;
  const first = draft.pts[0];
  const closing =
    draft.pts.length >= 3 && rawCursor && Math.hypot(rawCursor.x - first[0], rawCursor.y - first[1]) * scale <= 9;
  return (
    <>
      {pts.length >= 3 && <Line points={flatten(pts)} closed fill={fill} opacity={0.45} />}
      <Outlined pts={pts} closed={false} scale={scale} />
      {draft.pts.map((p, i) => (
        <Handle key={i} p={p} scale={scale} />
      ))}
      {closing && <Circle x={first[0]} y={first[1]} radius={8 / scale} stroke={SELECTION_COLOR} strokeWidth={2 / scale} />}
    </>
  );
}

interface OverlayProps {
  selected: MapObject | null;
  draft: Draft | null;
  cursor: XY | null;
  rawCursor: XY | null;
  crosshair: boolean;
  eraser: boolean;
  kind: SurfaceKind;
  scale: number;
  selectedEdgeIndex: number | null;
}

export function EditorOverlay({ selected, draft, cursor, rawCursor, crosshair, eraser, kind, scale, selectedEdgeIndex }: OverlayProps) {
  const a = 6 / scale;
  const eraserPoint = rawCursor ?? cursor;
  return (
    <>
      {selected && !selected.hidden && <SelectionOutline shape={selected} scale={scale} selectedEdgeIndex={selectedEdgeIndex} />}
      {draft && <DraftPreview draft={draft} cursor={cursor} rawCursor={rawCursor} kind={kind} scale={scale} />}
      {eraser && eraserPoint && <Circle x={eraserPoint.x} y={eraserPoint.y} radius={ERASER_WIDTH / 2} fill="rgba(23,112,122,.14)" stroke={SELECTION_COLOR} strokeWidth={1 / scale} />}
      {crosshair && cursor && (
        <>
          <Line points={[cursor.x - a, cursor.y, cursor.x + a, cursor.y]} stroke={SELECTION_COLOR} strokeWidth={1.4 / scale} />
          <Line points={[cursor.x, cursor.y - a, cursor.x, cursor.y + a]} stroke={SELECTION_COLOR} strokeWidth={1.4 / scale} />
        </>
      )}
    </>
  );
}
