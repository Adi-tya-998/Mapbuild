import type { MapDocument } from '../types/project';

export function emptyDocument(name = 'Untitled map'): MapDocument {
  return { name, shapes: [], background: null };
}
