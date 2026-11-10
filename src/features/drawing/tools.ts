import { Circle, CirclePlus, Eraser, Minus, MousePointer2, Pentagon, Spline, Square, Type } from 'lucide-react';
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
    hint: 'Click a shape to select it. Drag to move, drag a vertex to reshape, or drag the rotate handle above a polygon, rectangle, line, or curve. Hold Alt while dragging a rectangle corner or circle radius handle to move that point freely; without Alt they resize normally. Ctrl+left-drag to detach a boxed area from polygons; blue vertices edit the new edges. Ctrl+right-drag box-selects layers for Delete. Double-click an edge to add a point, Shift-click a point to remove it. Arrow keys nudge. Scroll to zoom; drag with Space or the middle mouse button to pan.',
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
    id: 'point',
    label: 'Add point',
    key: 'I',
    icon: CirclePlus,
    hint: 'Click any polygon or rectangle edge to add an editable vertex. Switch to Select to drag the new point.',
  },
  {
    id: 'eraser',
    label: 'Eraser',
    key: 'E',
    icon: Eraser,
    hint: 'Left-drag to erase only the swept area. Hold Ctrl and left-drag to erase boundaries. Use the mode menu for polygon-edge openings.',
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
