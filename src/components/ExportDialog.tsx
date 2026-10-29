import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadBlob, fileSlug } from '../lib/download';
import { renderPng } from '../lib/exportPng';
import { useEditorStore } from '../stores/editorStore';

const SIZES = [720, 1080, 2160];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState(1080);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const run = async () => {
    const { doc, showToast } = useEditorStore.getState();
    setBusy(true);
    try {
      const blob = await renderPng(doc, size);
      downloadBlob(`${fileSlug(doc.name)}.png`, blob);
      showToast(`PNG exported at ${size} px.`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not export the image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="dlg" onClose={onClose} aria-labelledby="export-title">
      <h2 id="export-title">Export PNG</h2>
      <p className="muted">Exports only your map shapes on a transparent background. Reference images, the grid, and selection handles are excluded.</p>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="export-size">Image size</label>
        <select id="export-size" className="form-select form-select-sm" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {SIZES.map((n) => (
            <option key={n} value={n}>
              {n} × {n} px
            </option>
          ))}
        </select>
      </div>
      <div className="row dlg-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn primary" disabled={busy} onClick={run}>
          <Download /> {busy ? 'Rendering…' : 'Export PNG'}
        </button>
      </div>
    </dialog>
  );
}
