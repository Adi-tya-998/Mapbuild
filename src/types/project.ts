import type { MapObject } from './map';

export interface Background {
  /** Data URL (png/jpeg) so the image travels with the project in JSON and local storage. */
  dataUrl: string;
  opacity: number;
  visible: boolean;
}

/** Content that undo/redo tracks. */
export interface MapContent {
  shapes: MapObject[];
  background: Background | null;
}

export interface MapDocument extends MapContent {
  name: string;
}

export const FILE_APP = 'minimap-maker';
export const FILE_VERSION = 2;

/** Shape of exported JSON files and the autosave record. Version 1 files (original HTML editor) are still readable. */
export interface ProjectFile {
  app: typeof FILE_APP;
  version: number;
  name: string;
  size: number;
  shapes: Array<Record<string, unknown>>;
  background?: Background;
}
