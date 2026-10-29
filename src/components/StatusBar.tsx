import { TOOLS } from '../features/drawing/tools';
import { useEditorStore } from '../stores/editorStore';

export function StatusBar() {
  const tool = useEditorStore((s) => s.tool);
  const cursor = useEditorStore((s) => s.cursor);
  const draft = useEditorStore((s) => s.draft);

  let coords = 'x –  y –';
  if (cursor) {
    coords = `x ${cursor.x.toFixed(1)}  y ${cursor.y.toFixed(1)}`;
    if (draft?.type === 'rect') {
      coords += `  ${Math.abs(draft.b.x - draft.a.x).toFixed(1)} × ${Math.abs(draft.b.y - draft.a.y).toFixed(1)}`;
    } else if (draft?.type === 'circle') {
      coords += `  Ø ${(Math.hypot(draft.edge.x - draft.center.x, draft.edge.y - draft.center.y) * 2).toFixed(1)} u`;
    } else if (draft?.type === 'line') {
      coords += `  ${Math.hypot(draft.b.x - draft.a.x, draft.b.y - draft.a.y).toFixed(1)} u`;
    } else if (draft?.type === 'curve') {
      coords += `  ${draft.pts.length} points`;
    }
  }

  return (
    <div className="status">
      <span className="coords">{coords}</span>
      <span className="hint">{TOOLS.find((t) => t.id === tool)?.hint}</span>
    </div>
  );
}
