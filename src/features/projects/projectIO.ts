import { downloadBlob, fileSlug } from '../../lib/download';
import { readBackgroundFile } from '../../lib/image';
import { ProjectParseError, parseProjectText, serializeProject } from '../../lib/validation';
import { useEditorStore } from '../../stores/editorStore';

const MAX_PROJECT_BYTES = 30 * 1024 * 1024;

const toast = (message: string) => useEditorStore.getState().showToast(message);
const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ProjectParseError || err instanceof Error ? err.message : fallback;

/** Open a project JSON file (also accepts maps saved by the original single-file editor). */
export async function openProjectFile(file: File): Promise<void> {
  if (file.size > MAX_PROJECT_BYTES) {
    toast('That file is too large to be a map.');
    return;
  }
  try {
    const { doc, skipped } = parseProjectText(await file.text());
    useEditorStore.getState().openDocument(doc);
    const dropped = skipped ? ` ${skipped} invalid item${skipped === 1 ? ' was' : 's were'} skipped.` : '';
    toast(`Opened “${doc.name}” with ${doc.shapes.length} shapes.${dropped}`);
  } catch (err) {
    toast(errorMessage(err, 'That file could not be read.'));
  }
}

export function saveProjectFile(): void {
  const { doc } = useEditorStore.getState();
  try {
    const json = JSON.stringify(serializeProject(doc), null, 2);
    downloadBlob(`${fileSlug(doc.name)}.json`, new Blob([json], { type: 'application/json' }));
    toast('Map saved as JSON. Use Open to load it again.');
  } catch {
    toast('Could not save the file. Your browser may have blocked the download.');
  }
}

export async function importBackgroundImage(file: File): Promise<void> {
  try {
    useEditorStore.getState().setBackground(await readBackgroundFile(file));
    toast('Background image added. Adjust its opacity in the panel.');
  } catch (err) {
    toast(errorMessage(err, 'Could not import that image.'));
  }
}

/** Handle a file dropped on the sheet: images become the background, anything else is opened as a project. */
export function handleDroppedFile(file: File | undefined): Promise<void> {
  if (!file) return Promise.resolve();
  return file.type.startsWith('image/') ? importBackgroundImage(file) : openProjectFile(file);
}
