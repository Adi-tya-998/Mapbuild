/** Trigger a browser download for a Blob. Throws if the browser blocks it. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a moment to start the download before releasing the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export function fileSlug(name: string): string {
  return (
    (name || 'minimap')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'minimap'
  );
}
