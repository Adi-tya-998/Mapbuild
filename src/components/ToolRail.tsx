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
          title="Choose between area erasing and polygon-edge openings"
          value={eraserMode}
          onChange={(event) => setEraserMode(event.target.value as 'area' | 'edges')}
        >
          <option value="area">Erase area</option>
          <option value="edges">Polygon edges only</option>
        </select>
      )}
    </nav>
  );
}
