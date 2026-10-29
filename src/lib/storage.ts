import type { ProjectFile } from '../types/project';
import type { ParseResult } from './validation';
import { parseProject, parseProjectText } from './validation';

/**
 * All browser persistence lives here.
 * - Autosave record: IndexedDB (handles large background images), falling back to localStorage.
 * - Small preferences (theme): localStorage.
 */

const DB_NAME = 'minimap-maker';
const STORE = 'projects';
const AUTOSAVE_KEY = 'autosave';
/** Key used by the original single-file editor; read once so existing maps are not lost. */
const LEGACY_KEY = 'minimap-maker/v1';
const FALLBACK_KEY = 'minimap-maker/autosave';
const THEME_KEY = 'minimap-maker/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDb();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    });
  } finally {
    db.close();
  }
}

export async function saveAutosave(file: ProjectFile): Promise<void> {
  try {
    await idbPut(AUTOSAVE_KEY, file);
    return;
  } catch {
    /* fall through to localStorage */
  }
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(file));
  } catch {
    throw new Error('Browser storage is unavailable or full, so this map is not being autosaved.');
  }
}

function tryParse(read: () => ParseResult | null): ParseResult | null {
  try {
    return read();
  } catch {
    return null;
  }
}

/** Restore the last autosaved project, or null when there is none (or it cannot be read). */
export async function loadAutosave(): Promise<ParseResult | null> {
  try {
    const stored = await idbGet(AUTOSAVE_KEY);
    const r = stored ? tryParse(() => parseProject(stored)) : null;
    if (r) return r;
  } catch {
    /* try the fallbacks */
  }
  for (const key of [FALLBACK_KEY, LEGACY_KEY]) {
    try {
      const text = localStorage.getItem(key);
      const r = text ? tryParse(() => parseProjectText(text)) : null;
      if (r) return r;
    } catch {
      /* storage blocked */
    }
  }
  return null;
}

export function loadTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* preference simply won't persist */
  }
}
