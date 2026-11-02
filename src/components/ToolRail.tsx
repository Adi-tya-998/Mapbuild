import { TOOLS } from '../features/drawing/tools';
import { useEditorStore } from '../stores/editorStore';

export function ToolRail() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const eraserMode = useEditorStore((s) => s.eraserMode);
  const setEraserMode = useEditorStore((s) => s.setEraserMode);

  return (
    <nav className="tools" aria-label="Tools">
      {TOOLS.map(({ id, label, key, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className="tool"
          aria-pressed={tool === id}
          title={`${label} (${key})`}
          aria-label={label}
          onClick={() => setTool(id)}
        >
          <Icon aria-hidden="true" />
          <kbd>{key}</kbd>
        </button>
      ))}
      {tool === 'eraser' && (
        <select
          className="eraser-mode-select form-select form-select-sm"
          aria-label="Eraser mode"
          title="Choose whether the eraser removes shapes or opens polygon edges"
          value={eraserMode}
          onChange={(event) => setEraserMode(event.target.value as 'objects' | 'edges')}
        >
          <option value="objects">Erase shapes</option>
          <option value="edges">Polygon edges only</option>
        </select>
      )}
    </nav>
  );
}
