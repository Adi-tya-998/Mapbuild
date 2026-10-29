import { useRef, useState } from 'react';
import { FilePlus, FolderOpen, ImageDown, Map as MapIcon, Maximize, Minus, Monitor, Moon, Plus, Redo2, Save, Sun, Undo2 } from 'lucide-react';
import { openProjectFile, saveProjectFile } from '../features/projects/projectIO';
import { fitTransform } from '../lib/geometry';
import { useEditorHistory } from '../hooks/useEditorHistory';
import { useEditorStore } from '../stores/editorStore';
import type { ThemeMode } from '../lib/storage';

const NEXT_THEME: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const OFFICIAL_MAPS = [
  'Abyss',
  'Ascent',
  'Bind',
  'Breeze',
  'Corrode',
  'Fracture',
  'Haven',
  'Icebox',
  'Lotus',
  'Pearl',
  'Split',
  'Sunset',
  'Summit',
];

export function EditorToolbar({ onExport }: { onExport: () => void }) {
  const { canUndo, canRedo, undo, redo } = useEditorHistory();
  const name = useEditorStore((s) => s.doc.name);
  const grid = useEditorStore((s) => s.grid);
  const snap = useEditorStore((s) => s.snap);
  const gridSize = useEditorStore((s) => s.gridSize);
  const theme = useEditorStore((s) => s.theme);
  const scale = useEditorStore((s) => s.view.scale);
  const viewport = useEditorStore((s) => s.viewport);
  const st = useEditorStore.getState;
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedOfficialMap, setSelectedOfficialMap] = useState('');

  const zoomPct = Math.round((scale / fitTransform(viewport.w, viewport.h).scale) * 100);
  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="top navbar d-flex align-items-center">
      <div className="brand navbar-brand">
        <MapIcon aria-hidden="true" />
        <span className="brand-copy"><small>TACTICAL MAP EDITOR</small>Minimap Maker</span>
      </div>
      <span className="badge rounded-pill local-badge">LOCAL PROJECT</span>
      <div className="namefield">
        <label className="sr" htmlFor="map-name">
          Map name
        </label>
        <input
          id="map-name"
          type="text"
          className="form-control form-control-sm"
          maxLength={60}
          autoComplete="off"
          placeholder="Map name"
          value={name}
          onChange={(e) => st().setName(e.target.value)}
        />
      </div>

      <select
        className="form-select form-select-sm map-select"
        aria-label="Select an official VALORANT map"
        title="Choose an official map (layouts can be added later)"
        value={selectedOfficialMap}
        onChange={(e) => {
          const map = e.target.value;
          setSelectedOfficialMap(map);
          if (map) st().resetSheetForOfficialMap(map);
        }}
      >
        <option value="">Official maps…</option>
        {OFFICIAL_MAPS.map((map) => (
          <option key={map} value={map}>
            {map}
          </option>
        ))}
      </select>

      <div className="grp" role="group" aria-label="History">
        <button type="button" className="btn icon" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 />
        </button>
        <button type="button" className="btn icon" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 />
        </button>
      </div>

      <div className="grp" role="group" aria-label="Grid">
        <button type="button" className="btn" aria-pressed={grid} onClick={() => st().toggleGrid()}>
          Grid
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={snap}
          title="Hold Alt while drawing to ignore snapping"
          onClick={() => st().toggleSnap()}
        >
          Snap
        </button>
        <select
          className="form-select form-select-sm compact-select"
          aria-label="Grid size in map units"
          value={gridSize}
          onChange={(e) => st().setGridSize(Number(e.target.value))}
        >
          {[1, 2, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'unit' : 'units'}
            </option>
          ))}
        </select>
      </div>

      <div className="grp" role="group" aria-label="Zoom">
        <button type="button" className="btn icon" title="Zoom out" aria-label="Zoom out" onClick={() => st().zoomAt(1 / 1.25)}>
          <Minus />
        </button>
        <span className="zoomlbl mono" aria-live="off">
          {zoomPct}%
        </span>
        <button type="button" className="btn icon" title="Zoom in" aria-label="Zoom in" onClick={() => st().zoomAt(1.25)}>
          <Plus />
        </button>
        <button type="button" className="btn icon" title="Fit sheet to window" aria-label="Fit to window" onClick={() => st().fitView()}>
          <Maximize />
        </button>
      </div>

      <div className="grp right">
        <button
          type="button"
          className="btn icon"
          title={`Theme: ${theme} (click to change)`}
          aria-label={`Theme: ${theme}. Switch theme`}
          onClick={() => st().setTheme(NEXT_THEME[theme])}
        >
          <ThemeIcon />
        </button>
        <button type="button" className="btn" title="Clear the sheet (undo brings it back)" onClick={() => st().newProject()}>
          <FilePlus /> New
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          <FolderOpen /> Open
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void openProjectFile(file);
          }}
        />
        <button type="button" className="btn" onClick={saveProjectFile}>
          <Save /> Save map
        </button>
        <button type="button" className="btn primary" onClick={onExport}>
          <ImageDown /> Export PNG
        </button>
      </div>
    </header>
  );
}
