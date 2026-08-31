import { MAX_IMAGE_EDGE } from "@/lib/compressImage";

/** A rectangle in the source image's own pixel coordinates. */
export type CropRect = { x: number; y: number; width: number; height: number };

const JPEG_QUALITY = 0.9;

function toJpegName(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Cuts `rect` out of `file` and returns it as a new JPEG.
 *
 * Cards and avatars render the photo as a square with `object-cover`, so a tall
 * phone portrait loses its top and bottom to the browser's centre crop. This
 * lets the admin decide what survives instead, once, at upload time -- the
 * stored image is already the right shape everywhere it is shown.
 *
 * Quality is a notch above the compression pass because a crop throws pixels
 * away; the result then goes through `compressImage` as usual.
 */
export async function cropImageFile(
  file: File,
  rect: CropRect,
  maxEdge = MAX_IMAGE_EDGE,
  quality = JPEG_QUALITY,
): Promise<File> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot crop images.");
  }

  const bitmap = await createImageBitmap(file);

  try {
    // The caller works in floating-point CSS space; snap to real pixels and
    // keep the rectangle inside the image whatever rounding did.
    const x = clamp(Math.round(rect.x), 0, Math.max(0, bitmap.width - 1));
    const y = clamp(Math.round(rect.y), 0, Math.max(0, bitmap.height - 1));
    const width = clamp(Math.round(rect.width), 1, bitmap.width - x);
    const height = clamp(Math.round(rect.height), 1, bitmap.height - y);

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the image.");

    // JPEG has no alpha channel -- paint white so a transparent logo does not
    // come out on black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, x, y, width, height, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Could not read that image.");

    return new File([blob], toJpegName(file.name || "photo.jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

/**
 * Pulls an already-uploaded photo back down as a File so it can be re-cropped.
 * Supabase serves signed URLs with permissive CORS, so this stays a plain fetch
 * rather than an <img> that would taint the canvas.
 */
export async function fetchImageAsFile(url: string, name = "photo.jpg"): Promise<File> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load that photo (${response.status}).`);

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("That file is not an image.");

  return new File([blob], name, { type: blob.type, lastModified: Date.now() });
}
