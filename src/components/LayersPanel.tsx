import { Check, ChevronDown, ChevronRight, Eye, EyeOff, Folder, GripVertical, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { SURFACES } from '../types/map';
import type { MapObject } from '../types/map';

interface LayerEntry {
  shape: MapObject;
  name: string;
}

/** Names like "Floor 3" (numbered per surface in stacking order) or “label text”. */
export function layerNames(shapes: MapObject[]): string[] {
  const counts: Partial<Record<string, number>> = {};
  return shapes.map((s) => {
    if (s.type === 'label') return s.name?.trim() || `“${s.text}”`;
    const name = s.type === 'line' ? 'Line' : s.type === 'curve' ? 'Curve' : s.type === 'circle' ? 'Circle' : SURFACES[s.kind].name;
    counts[name] = (counts[name] ?? 0) + 1;
    return s.name?.trim() || `${name} ${counts[name]}`;
  });
}

export function LayersPanel() {
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; type: 'group' | 'layer' } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const cancelRenameOnBlur = useRef(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'group' | 'layer' } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; type: 'group' | 'layer'; placement: 'before' | 'after' } | null>(null);
  const shapes = useEditorStore((s) => s.doc.shapes);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const toggleHidden = useEditorStore((s) => s.toggleHidden);
  const groupingSelection = useEditorStore((s) => s.groupingSelection);
  const toggleGroupingSelection = useEditorStore((s) => s.toggleGroupingSelection);
  const groupSelectedLayers = useEditorStore((s) => s.groupSelectedLayers);
  const addLayerToGroup = useEditorStore((s) => s.addLayerToGroup);
  const renameLayer = useEditorStore((s) => s.renameLayer);
  const renameGroup = useEditorStore((s) => s.renameGroup);
  const reorderGroup = useEditorStore((s) => s.reorderGroup);
  const reorderLayer = useEditorStore((s) => s.reorderLayer);
  const ungroupSelectedLayers = useEditorStore((s) => s.ungroupSelectedLayers);
  const canUngroup = shapes.some((shape) => groupingSelection.includes(shape.id) && !!shape.groupId);
  const names = layerNames(shapes);

  const startRename = (id: string, type: 'group' | 'layer', currentName: string) => {
    cancelRenameOnBlur.current = false;
    setRenaming({ id, type });
    setRenameDraft(currentName);
  };

  const finishRename = () => {
    if (cancelRenameOnBlur.current) {
      cancelRenameOnBlur.current = false;
      return;
    }
    if (renaming?.type === 'layer') renameLayer(renaming.id, renameDraft);
    if (renaming?.type === 'group') renameGroup(renaming.id, renameDraft);
    setRenaming(null);
  };

  const cancelRename = () => {
    cancelRenameOnBlur.current = true;
    setRenaming(null);
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelRename();
      event.currentTarget.blur();
    }
  };

  // The document is stored back-to-front. This panel lists the frontmost layer first.
  const entries = useMemo(() => {
    const topDown: LayerEntry[] = shapes.map((shape, i) => ({ shape, name: names[i] })).reverse();
    const members = new Map<string, LayerEntry[]>();
    const groupNumbers = new Map<string, number>();
    topDown.forEach((entry) => {
      const { shape } = entry;
      if (!shape.groupId) return;
      if (!groupNumbers.has(shape.groupId)) groupNumbers.set(shape.groupId, groupNumbers.size + 1);
      const groupMembers = members.get(shape.groupId) ?? [];
      groupMembers.push(entry);
      members.set(shape.groupId, groupMembers);
    });

    const result: Array<{ kind: 'layer'; entry: LayerEntry } | { kind: 'group'; id: string; number: number; members: LayerEntry[] }> = [];
    const emittedGroups = new Set<string>();
    topDown.forEach((entry) => {
      const groupId = entry.shape.groupId;
      if (!groupId) {
        result.push({ kind: 'layer', entry });
      } else if (!emittedGroups.has(groupId)) {
        emittedGroups.add(groupId);
        result.push({ kind: 'group', id: groupId, number: groupNumbers.get(groupId)!, members: members.get(groupId)! });
      }
    });
    return result;
  }, [shapes, names]);

  const toggleCollapsed = (groupId: string) => {
    setCollapsedGroups((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  };

  const getDropPlacement = (event: DragEvent<HTMLElement>): 'before' | 'after' => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, id: string, type: 'group' | 'layer') => {
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.setData('application/x-minimapmaker-layer-type', type);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ id, type });
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, id: string, type: 'group' | 'layer', targetGroupId?: string) => {
    if (!draggedItem || (type === 'group' && draggedItem.type === 'group' && draggedItem.id === id) ||
      (type === 'layer' && draggedItem.type === 'layer' && draggedItem.id === id) ||
      (targetGroupId && draggedItem.type === 'group' && targetGroupId === draggedItem.id)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const placement = getDropPlacement(event);
    if (dropTarget?.id !== id || dropTarget.type !== type || dropTarget.placement !== placement) {
      setDropTarget({ id, type, placement });
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>, id: string, type: 'group' | 'layer', targetGroupId?: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain') || draggedItem?.id;
    const sourceType = (event.dataTransfer.getData('application/x-minimapmaker-layer-type') || draggedItem?.type) as 'group' | 'layer' | undefined;
    if (sourceId && sourceType === 'group' && sourceId !== targetGroupId && !(type === 'group' && sourceId === id)) {
      reorderGroup(sourceId, id, type, getDropPlacement(event));
    } else if (sourceId && sourceType === 'layer' && sourceId !== targetGroupId) {
      reorderLayer(sourceId, id, type, getDropPlacement(event));
    }
    setDraggedItem(null);
    setDropTarget(null);
  };

  const renderLayer = ({ shape, name }: LayerEntry) => (
    <li key={shape.id}>
      <div
        className="layer-row"
        onDragOver={(event) => handleDragOver(event, shape.id, 'layer', shape.groupId)}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTarget?.id === shape.id && dropTarget.type === 'layer') setDropTarget(null);
        }}
        onDrop={(event) => handleDrop(event, shape.id, 'layer', shape.groupId)}
      >
        <input
          className="layer-group-check"
          type="checkbox"
          checked={groupingSelection.includes(shape.id)}
          aria-label={`Select ${name} for grouping`}
          title="Select layer for grouping"
          onChange={() => toggleGroupingSelection(shape.id)}
        />
        {renaming?.type === 'layer' && renaming.id === shape.id ? (
          <input
            className="layer-name-input"
            aria-label={`Rename ${name}`}
            autoFocus
            maxLength={60}
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onBlur={finishRename}
            onKeyDown={handleRenameKeyDown}
          />
        ) : <button
          type="button"
          className={`layer${dropTarget?.id === shape.id && dropTarget.type === 'layer' ? ` drop-${dropTarget.placement}` : ''}${draggedItem?.type === 'layer' && draggedItem.id === shape.id ? ' is-dragging' : ''}`}
          draggable
          aria-current={shape.id === selectedId ? 'true' : undefined}
          onDragStart={(event) => handleDragStart(event, shape.id, 'layer')}
          onDragEnd={() => {
            setDraggedItem(null);
            setDropTarget(null);
          }}
          onClick={() => select(shape.id)}
        >
          {shape.type === 'label' ? (
            <span className="chip chip-label">T</span>
          ) : (
            <span className="chip" style={{ background: SURFACES[shape.kind].fill }} />
          )}
          <span className="nm">{name}</span>
        </button>}
        {renaming?.type === 'layer' && renaming.id === shape.id ? (
          <>
            <button type="button" className="layer-rename" aria-label="Save layer name" title="Save" onMouseDown={(event) => event.preventDefault()} onClick={finishRename}><Check /></button>
            <button type="button" className="layer-rename" aria-label="Cancel layer rename" title="Cancel" onMouseDown={(event) => event.preventDefault()} onClick={cancelRename}><X /></button>
          </>
        ) : (
          <button type="button" className="layer-rename" aria-label={`Rename ${name}`} title={`Rename ${name}`} onClick={() => startRename(shape.id, 'layer', name)}><Pencil /></button>
        )}
        <button
          type="button"
          className="eye"
          aria-pressed={!!shape.hidden}
          aria-label={`${shape.hidden ? 'Show' : 'Hide'} ${name}`}
          title={shape.hidden ? 'Show' : 'Hide'}
          onClick={() => toggleHidden(shape.id)}
        >
          {shape.hidden ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </li>
  );

  return (
    <section className="sec card">
      <h2 className="card-header">Layers</h2>
      <div className="layer-group-actions">
        <button type="button" disabled={groupingSelection.length < 2} onClick={groupSelectedLayers}>Group selected</button>
        <button type="button" disabled={!canUngroup} onClick={ungroupSelectedLayers}>Ungroup</button>
      </div>
      <ul className="layers">
        {entries.map((entry) => entry.kind === 'layer' ? renderLayer(entry.entry) : (
          <li className="layer-folder-row" key={entry.id}>
            <div className="layer-row">
              {renaming?.type === 'group' && renaming.id === entry.id ? (
                <input
                  className="layer-name-input"
                  aria-label={`Rename Group ${entry.number}`}
                  autoFocus
                  maxLength={60}
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={finishRename}
                  onKeyDown={handleRenameKeyDown}
                />
              ) : <button
                type="button"
                className={`layer-folder-toggle${dropTarget?.id === entry.id && dropTarget.type === 'group' ? ` drop-${dropTarget.placement}` : ''}${draggedItem?.type === 'group' && draggedItem.id === entry.id ? ' is-dragging' : ''}`}
                draggable
                aria-expanded={!collapsedGroups.includes(entry.id)}
                aria-label={`Drag to reorder or click to ${collapsedGroups.includes(entry.id) ? 'expand' : 'collapse'} ${entry.members[0]?.shape.groupName || `Group ${entry.number}`}`}
                title={`Drag to move ${entry.members[0]?.shape.groupName || `Group ${entry.number}`}. Click to collapse or expand.`}
                onDragStart={(event) => handleDragStart(event, entry.id, 'group')}
                onDragOver={(event) => {
                  handleDragOver(event, entry.id, 'group');
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTarget?.id === entry.id && dropTarget.type === 'group') setDropTarget(null);
                }}
                onDrop={(event) => handleDrop(event, entry.id, 'group')}
                onDragEnd={() => {
                  setDraggedItem(null);
                  setDropTarget(null);
                }}
                onClick={() => toggleCollapsed(entry.id)}
              >
                <GripVertical className="group-drag-handle" />
                {collapsedGroups.includes(entry.id) ? <ChevronRight /> : <ChevronDown />}
                <Folder className="folder-icon" />
                <span>{entry.members[0]?.shape.groupName || `Group ${entry.number}`}</span>
                <span className="layer-folder-count">{entry.members.length}</span>
              </button>}
              {renaming?.type === 'group' && renaming.id === entry.id ? (
                <>
                  <button type="button" className="layer-rename" aria-label="Save group name" title="Save" onMouseDown={(event) => event.preventDefault()} onClick={finishRename}><Check /></button>
                  <button type="button" className="layer-rename" aria-label="Cancel group rename" title="Cancel" onMouseDown={(event) => event.preventDefault()} onClick={cancelRename}><X /></button>
                </>
              ) : (
                <button type="button" className="layer-rename" aria-label={`Rename Group ${entry.number}`} title="Rename group" onClick={() => startRename(entry.id, 'group', entry.members[0]?.shape.groupName || `Group ${entry.number}`)}><Pencil /></button>
              )}
              <button
                type="button"
                className="layer-add"
                aria-label={`Add a layer to Group ${entry.number}`}
                aria-expanded={addingToGroup === entry.id}
                title={`Add one layer to Group ${entry.number}`}
                onClick={() => setAddingToGroup(addingToGroup === entry.id ? null : entry.id)}
              >
                <Plus />
              </button>
            </div>
            {addingToGroup === entry.id && (
              <div className="layer-add-menu">
                <span>Add one layer to Group {entry.number}</span>
                {shapes.filter((shape) => shape.groupId !== entry.id).map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => {
                      addLayerToGroup(shape.id, entry.id);
                      setAddingToGroup(null);
                    }}
                  >
                    {names[shapes.findIndex((candidate) => candidate.id === shape.id)]}
                  </button>
                ))}
                {shapes.every((shape) => shape.groupId === entry.id) && <span className="muted">No other layers to add.</span>}
              </div>
            )}
            {!collapsedGroups.includes(entry.id) && (
              <ul className="layer-children">
                {entry.members.map(renderLayer)}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {shapes.length === 0 && <p className="muted">No shapes yet. Pick a drawing tool and draw on the sheet.</p>}
    </section>
  );
}
