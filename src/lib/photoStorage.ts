import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Entry photos and nominee card photos share one private bucket. */
export const PHOTO_BUCKET = "applicant-logos";

/**
 * Filename of the uncropped copy kept beside a cropped photo.
 *
 * A crop is destructive -- it re-encodes and throws pixels away -- so the file
 * that went in is stored alongside it and a crop stays undoable. Only one is
 * ever kept per photo: the version the crop was taken from. Uploading a
 * genuinely new photo clears it, because at that moment the live file *is* the
 * original and there is nothing to go back to.
 */
const ORIGINAL_STEM = "original";

/** Storage client for the photo bucket. Service role: callers must be admins. */
export function photoStorage() {
  return createAdminClient().storage.from(PHOTO_BUCKET);
}

export function extensionFor(type: string): string {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type] ?? "bin";
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function contentTypeFor(path: string): string {
  return CONTENT_TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? "image/jpeg";
}

/** Path of the stored original for `folder`, or null when there is none. */
export async function findOriginal(folder: string): Promise<string | null> {
  const { data } = await photoStorage().list(folder, { limit: 100 });
  const entry = data?.find((file) => file.name.startsWith(`${ORIGINAL_STEM}.`));
  return entry ? `${folder}/${entry.name}` : null;
}

/** Short-lived URL for the stored original, for a "view it first" link. */
export async function signOriginal(
  folder: string,
  expiresIn = 60 * 10,
): Promise<string | null> {
  const path = await findOriginal(folder);
  if (!path) return null;
  const { data } = await photoStorage().createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Deletes every stored original under `folder`, except `keep`. */
export async function clearOriginals(folder: string, keep?: string): Promise<void> {
  const { data } = await photoStorage().list(folder, { limit: 100 });
  const stale = (data ?? [])
    .filter((file) => file.name.startsWith(`${ORIGINAL_STEM}.`))
    .map((file) => `${folder}/${file.name}`)
    .filter((path) => path !== keep);
  if (stale.length > 0) await photoStorage().remove(stale);
}

/** Stores `file` as the undo copy for `folder`, replacing any earlier one. */
export async function keepOriginal(folder: string, file: File): Promise<void> {
  const path = `${folder}/${ORIGINAL_STEM}.${extensionFor(file.type)}`;
  const { error } = await photoStorage().upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  // Losing the undo copy must not fail the upload it belongs to; the crop
  // itself is already saved by the time this runs.
  if (error) return;
  await clearOriginals(folder, path);
}

/**
 * Puts the stored original back at `toPath` and drops the undo copy -- after a
 * restore the live file is the original, so there is nothing left to restore.
 *
 * Copied by hand rather than with storage `copy()`, which cannot overwrite an
 * existing destination, and the destination is exactly what we are replacing.
 */
export async function restoreOriginal(
  folder: string,
  buildPath: (extension: string) => string,
): Promise<{ path: string } | { error: string }> {
  const original = await findOriginal(folder);
  if (!original) return { error: "There is no original photo to restore." };

  const storage = photoStorage();
  const { data: blob, error: downloadError } = await storage.download(original);
  if (downloadError || !blob) {
    return { error: downloadError?.message ?? "Could not read the original photo." };
  }

  const extension = original.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = buildPath(extension);

  const { error: uploadError } = await storage.upload(path, blob, {
    contentType: contentTypeFor(original),
    upsert: true,
  });
  if (uploadError) return { error: uploadError.message };

  await clearOriginals(folder);
  return { path };
}
