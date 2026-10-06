/**
 * Which of an entry's nominees should take its photo when the entry's photo
 * changes from `fromPath` to `toPath` (null meaning "no photo").
 *
 *  - A nominee still sharing the old object follows it to the new one, or to
 *    nothing on removal -- a crop always lands at a new path, and the old
 *    object is deleted.
 *  - A nominee with no photo at all picks up a new one. She was promoted
 *    before the entry had a photo; without this, an upload made afterwards
 *    would never reach her voting page.
 *
 * A nominee with her own photo (uploaded on the nominee screen, under
 * `nominees/`) matches neither and keeps it.
 *
 * Pure, with no imports, so the rule can be checked on its own.
 */
export function nomineesToFollow<T extends { photo_path: string | null }>(
  nominees: T[],
  fromPath: string | null,
  toPath: string | null,
): T[] {
  return nominees.filter(
    (nominee) =>
      (fromPath !== null && nominee.photo_path === fromPath) ||
      (toPath !== null && nominee.photo_path === null),
  );
}
