import type { Background } from '../types/project';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 2048;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = src;
  });
}

/** Read a local image file into a background, downscaled so it stays practical to store. */
export async function readBackgroundFile(file: File): Promise<Background> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use a PNG, JPEG or WebP image.');
  if (file.size > MAX_FILE_BYTES) throw new Error('That image is larger than 20 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
    return { dataUrl, opacity: 0.5, visible: true };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Rectangle (in map units) that fits an image inside the square sheet, centred, keeping its aspect ratio. */
export function containRect(imgW: number, imgH: number, sheet: number) {
  const s = Math.min(sheet / imgW, sheet / imgH);
  const width = imgW * s;
  const height = imgH * s;
  return { x: (sheet - width) / 2, y: (sheet - height) / 2, width, height };
}
