// Client-side image preparation: resize + WebP + strip EXIF/GPS before anything is uploaded.

export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function checkImageFile(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return 'Choose a photo to upload';
  if (!file.type.startsWith('image/') || (file.type && !ACCEPTED_TYPES.includes(file.type)))
    return 'That file is not a supported image (JPEG, PNG, WebP or HEIC)';
  if (file.size > MAX_SOURCE_BYTES) return 'That photo is larger than 25 MB';
  return null;
}

export type Prepared = { full: Blob; thumb: Blob };

export async function prepareImage(file: File, maxEdge = 2000, thumbEdge = 400): Promise<Prepared> {
  const { default: compress } = await import('browser-image-compression');
  const base = { fileType: 'image/webp', initialQuality: 0.8, useWebWorker: true, preserveExif: false } as const;
  const full = await compress(file, { ...base, maxWidthOrHeight: maxEdge, maxSizeMB: 1.5 });
  const thumb = await compress(file, { ...base, maxWidthOrHeight: thumbEdge, maxSizeMB: 0.2 });
  return { full, thumb };
}
