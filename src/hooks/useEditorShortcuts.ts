import { useEffect } from 'react';
import { TOOL_BY_KEY } from '../features/drawing/tools';
import { useEditorStore } from '../stores/editorStore';
import { isTypingTarget } from './useEditorHistory';

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Tool, delete, nudge, ordering, Space-to-pan and Alt tracking. Undo/redo shortcuts live in useEditorHistory. */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const st = useEditorStore.getState;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const s = st();
      s.setAlt(e.altKey);
      const key = e.key;

      if (key === ' ') {
        e.preventDefault();
        s.setSpaceHeld(true);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (key.toLowerCase() === 'd') {
          e.preventDefault();
          s.duplicateSelected();
        }
        return;
      }
      if (key === 'Escape') {
        if (s.draft) s.setDraft(null);
        else if (s.selectedId !== null) s.select(null);
        return;
      }
      if (key === 'Enter' && s.draft?.type === 'poly') {
        s.finishPolygon();
        return;
      }
      if (key === 'Backspace' && s.draft?.type === 'poly') {
        e.preventDefault();
        const pts = s.draft.pts.slice(0, -1);
        s.setDraft(pts.length ? { type: 'poly', pts } : null);
        return;
      }
      if (key === 'Delete' || key === 'Backspace') {
        if (s.selectedId !== null) {
          e.preventDefault();
          s.removeSelected();
        }
        return;
      }
      const arrow = ARROWS[key];
      if (arrow) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        s.nudgeSelected(arrow[0] * step, arrow[1] * step);
        return;
      }
      if (key === ']') {
        s.reorderSelected(1);
        return;
      }
      if (key === '[') {
        s.reorderSelected(-1);
        return;
      }
      const tool = TOOL_BY_KEY[key.toLowerCase()];
      if (tool) s.setTool(tool);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      st().setAlt(e.altKey);
      if (e.key === ' ' && !isTypingTarget(e.target)) {
        e.preventDefault();
        st().setSpaceHeld(false);
      }
    };
    const onBlur = () => {
      st().setSpaceHeld(false);
      st().setAlt(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
