import { useEffect, useRef } from 'react';
import { saveAutosave } from '../lib/storage';
import { serializeProject } from '../lib/validation';
import { useEditorStore } from '../stores/editorStore';

const DELAY_MS = 400;

/** Persist the document locally shortly after it changes. Paused until the saved project has been restored. */
export function useAutosave(): void {
  const doc = useEditorStore((s) => s.doc);
  const ready = useEditorStore((s) => s.status === 'ready');
  const warned = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const save = () =>
      saveAutosave(serializeProject(useEditorStore.getState().doc)).then(
        () => {
          warned.current = false;
        },
        (err: unknown) => {
          if (warned.current) return;
          warned.current = true;
          useEditorStore.getState().showToast(err instanceof Error ? err.message : 'Autosave failed.');
        },
      );
    const timer = window.setTimeout(save, DELAY_MS);
    // Best-effort flush when the tab is closed or hidden before the debounce fires.
    const flush = () => {
      window.clearTimeout(timer);
      void save();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', flush);
    };
  }, [doc, ready]);
}
