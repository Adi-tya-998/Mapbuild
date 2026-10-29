import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';

export function Toast() {
  const toast = useEditorStore((s) => s.toast);
  const clearToast = useEditorStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => clearToast(toast.id), 3200);
    return () => window.clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}
