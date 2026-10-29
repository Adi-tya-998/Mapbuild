import { Circle, Eraser, Minus, MousePointer2, Pentagon, Spline, Square, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tool } from '../../types/map';

export interface ToolDef {
  id: Tool;
  label: string;
  key: string;
  icon: LucideIcon;
  hint: string;
}

export const TOOLS: ToolDef[] = [
  {
    id: 'select',
    label: 'Select and edit',
    key: 'V',
    icon: MousePointer2,
    hint: 'Click a shape to select it. Drag to move, drag a handle to reshape. Double-click an edge to add a point, Shift-click a point to remove it. Arrow keys nudge. Scroll to zoom; drag with Space or the middle mouse button to pan.',
  },
  {
    id: 'poly',
    label: 'Polygon',
    key: 'P',
    icon: Pentagon,
    hint: 'Click to place points. Click the first point, double-click, or press Enter to finish. Backspace removes the last point, Esc cancels.',
  },
  {
    id: 'rect',
    label: 'Rectangle',
    key: 'R',
    icon: Square,
    hint: 'Drag to draw a rectangle. Hold Alt to ignore the grid.',
  },
  {
    id: 'circle',
    label: 'Circle',
    key: 'O',
    icon: Circle,
    hint: 'Drag from the center to set the circle radius. Hold Alt to ignore the grid.',
  },
  {
    id: 'line',
    label: 'Line boundary',
    key: 'L',
    icon: Minus,
    hint: 'Drag to draw a single straight boundary line. Hold Alt to ignore the grid.',
  },
  {
    id: 'curve',
    label: 'Curve boundary',
    key: 'C',
    icon: Spline,
    hint: 'Drag to sketch a smooth curved boundary. Hold Alt to ignore the grid.',
  },
  {
    id: 'eraser',
    label: 'Boundary eraser',
    key: 'E',
    icon: Eraser,
    hint: 'Open polygon edges like a doorway; erase only the brushed part of a drawn boundary.',
  },
  {
    id: 'label',
    label: 'Callout label',
    key: 'T',
    icon: Type,
    hint: 'Click to drop a callout label, then type its name in the panel.',
  },
];

export const TOOL_BY_KEY: Record<string, Tool> = Object.fromEntries(TOOLS.map((t) => [t.key.toLowerCase(), t.id]));
