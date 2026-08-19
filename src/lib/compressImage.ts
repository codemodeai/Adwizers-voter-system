/** Longest edge we keep. A nominee card never renders larger than this. */
export const MAX_IMAGE_EDGE = 1600;

/** Below this, a correctly-sized image is left completely untouched. */
const SKIP_UNDER_BYTES = 600 * 1024;

const JPEG_QUALITY = 0.85;

function toJpegName(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

/**
 * Downscales and re-encodes an image in the browser before it is posted.
 *
 * Photos straight off a phone are routinely 3-8 MB, which blows past both the
 * Server Action body limit and the 4.5 MB request cap on most hosts -- and
 * costs the applicant a slow upload on mobile data for pixels we then throw
 * away. Shrinking here keeps a typical entry well under 1 MB.
 *
 * Any failure returns the original file, so the server-side checks stay the
 * real gate rather than this being load-bearing.
 */
export async function compressImage(
  file: File,
  maxEdge = MAX_IMAGE_EDGE,
  quality = JPEG_QUALITY,
): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Format the browser cannot decode -- let the server decide.
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));

  // Already small in both dimensions and bytes: nothing worth doing.
  if (scale === 1 && file.size <= SKIP_UNDER_BYTES) {
    bitmap.close();
    return file;
  }

  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  // Output is JPEG, which has no alpha channel -- paint white underneath so a
  // transparent logo does not come out on a black background.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );

  // If re-encoding did not actually help, keep what the applicant chose.
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], toJpegName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
