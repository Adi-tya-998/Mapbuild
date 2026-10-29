import { TOOLS } from '../features/drawing/tools';
import { useEditorStore } from '../stores/editorStore';

export function ToolRail() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

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
    </nav>
  );
}
