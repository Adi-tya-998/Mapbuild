import { useEffect, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { Spline } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BackgroundImage, EditorOverlay, GridLines, SheetShapes } from '../features/drawing/CanvasNodes';
import { TOOLS } from '../features/drawing/tools';
import { useCanvasInteractions } from '../features/drawing/useCanvasInteractions';
import { handleDroppedFile } from '../features/projects/projectIO';
import { loadImage } from '../lib/image';
import { findShape, useEditorStore } from '../stores/editorStore';
import { SHEET_SIZE } from '../types/map';
import { Toast } from './Toast';

function useBackgroundImage(dataUrl: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!dataUrl) {
      setImage(null);
      return;
    }
    let alive = true;
    loadImage(dataUrl).then(
      (img) => alive && setImage(img),
      () => alive && setImage(null),
    );
    return () => {
      alive = false;
    };
  }, [dataUrl]);
  return image;
}

export function MapCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const quickMenuRef = useRef<HTMLButtonElement>(null);
  const [dropping, setDropping] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [quickMenu, setQuickMenu] = useState<{ x: number; y: number } | null>(null);

  const { doc, selectedId, selectedEdgeIndex, tool, kind, grid, gridSize, view, viewport, draft, cursor, rawCursor } = useEditorStore(
    useShallow((s) => ({
      doc: s.doc,
      selectedId: s.selectedId,
      selectedEdgeIndex: s.selectedEdgeIndex,
      tool: s.tool,
      kind: s.kind,
      grid: s.grid,
      gridSize: s.gridSize,
      view: s.view,
      viewport: s.viewport,
      draft: s.draft,
      cursor: s.cursor,
      rawCursor: s.rawCursor,
    })),
  );
  const setViewport = useEditorStore((s) => s.setViewport);
  const setTool = useEditorStore((s) => s.setTool);
  const bgImage = useBackgroundImage(doc.background?.dataUrl);

  const openQuickMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    setQuickMenu({
      x: Math.max(8, Math.min(bounds.width - 184, event.clientX - bounds.left)),
      y: Math.max(8, Math.min(bounds.height - 150, event.clientY - bounds.top)),
    });
  };

  useEffect(() => {
    if (!quickMenu) return;
    quickMenuRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-canvas-tool-menu]')) setQuickMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [quickMenu]);

  useCanvasInteractions(hostRef);

  // Track the available space. Object coordinates are in map units, so resizing never moves them.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setViewport(host.clientWidth, host.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, [setViewport]);

  // Labels are measured with the UI font; measure again once it has loaded.
  useEffect(() => {
    document.fonts?.load('600 12px "IBM Plex Sans"').then(() => setFontTick((t) => t + 1)).catch(() => {});
  }, []);

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDropping(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    void handleDroppedFile(e.dataTransfer.files[0]);
  };

  const selected = findShape(doc.shapes, selectedId);
  const { scale } = view;

  return (
    <div
      ref={hostRef}
      role="application"
      className={`stage${dropping ? ' drop' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
      onContextMenu={openQuickMenu}
      aria-label="Map sheet, 360 by 360 units"
    >
      {viewport.w > 0 && (
        <Stage width={viewport.w} height={viewport.h} x={view.x} y={view.y} scaleX={scale} scaleY={scale} listening={false}>
          {/* Sheet backdrop with drop shadow */}
          <Layer listening={false}>
            <Rect
              width={SHEET_SIZE}
              height={SHEET_SIZE}
              fill="#ffffff"
              shadowColor="#000000"
              shadowOpacity={0.25}
              shadowBlur={18 / scale}
              shadowOffsetY={5 / scale}
            />
          </Layer>
          {/* Map content, clipped to the sheet like the exported PNG */}
          <Layer listening={false} clipX={0} clipY={0} clipWidth={SHEET_SIZE} clipHeight={SHEET_SIZE}>
            <BackgroundImage image={bgImage} background={doc.background} />
            {grid && <GridLines gridSize={gridSize} scale={scale} />}
            <SheetShapes shapes={doc.shapes} fontTick={fontTick} />
          </Layer>
          <Layer listening={false}>
            <EditorOverlay
              selected={selected}
              draft={draft}
              cursor={cursor}
              rawCursor={rawCursor}
              crosshair={tool !== 'select' && tool !== 'eraser'}
              eraser={tool === 'eraser'}
              kind={kind}
              scale={scale}
              selectedEdgeIndex={selectedEdgeIndex}
            />
          </Layer>
        </Stage>
      )}
      {quickMenu && (
        <div
          className="canvas-tool-menu"
          data-canvas-tool-menu
          role="menu"
          aria-label="Quick drawing tools"
          style={{ left: quickMenu.x, top: quickMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="canvas-tool-menu-title">DRAW TOOL</div>
          {TOOLS.filter(({ id }) => id === 'poly' || id === 'line' || id === 'curve').map(({ id, label, key, icon: Icon }, index) => (
            <button
              key={id}
              ref={index === 0 ? quickMenuRef : undefined}
              type="button"
              role="menuitemradio"
              aria-checked={tool === id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setTool(id);
                setQuickMenu(null);
              }}
            >
              <Icon aria-hidden="true" />
              <span>{id === 'line' ? 'Line' : id === 'curve' ? 'Curve' : 'Polygon'}</span>
              <kbd>{key}</kbd>
            </button>
          ))}
          <span className="canvas-tool-menu-hint"><Spline aria-hidden="true" /> Right-click anywhere on the map</span>
        </div>
      )}
      <Toast />
    </div>
  );
}
