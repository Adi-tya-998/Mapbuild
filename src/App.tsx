import { useEffect, useState } from 'react';
import { EditorToolbar, ToolRail, StatusBar, useEditorShortcuts } from './features/toolbar';
import { ExportDialog } from './features/export';
import { LayersPanel } from './features/layers';
import { MapCanvas } from './components/MapCanvas';
import { PropertiesPanel } from './features/properties';
import { sampleDocument } from './features/projects';
import { useAutosave } from './hooks/useAutosave';
import { loadAutosave, saveTheme } from './lib/storage';
import { useEditorStore } from './stores/editorStore';

export default function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const theme = useEditorStore((s) => s.theme);

  useEditorShortcuts();
  useAutosave();

  // Restore the last autosaved project (or show the example map on first launch).
  useEffect(() => {
    let alive = true;
    loadAutosave()
      .catch(() => null)
      .then((saved) => {
        if (alive) useEditorStore.getState().hydrate(saved ? saved.doc : sampleDocument());
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  return (
    <div className="app container-fluid">
      <EditorToolbar onExport={() => setExportOpen(true)} />
      <div className="work">
        <ToolRail />
        <section className="stagecol">
          <MapCanvas />
          <StatusBar />
        </section>
        <aside className="side" aria-label="Properties">
          <PropertiesPanel />
          <LayersPanel />
        </aside>
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
