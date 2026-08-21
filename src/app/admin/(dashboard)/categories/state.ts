export type CategoryFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

export const EMPTY_CATEGORY_FORM_STATE: CategoryFormState = { status: "idle" };

/**
 * The slug is the shareable link (Final Plan sections 5 and 6), so it stays
 * lowercase, hyphenated, and free of anything that would need escaping in a
 * WhatsApp message.
 *
 * Lives outside the actions module so the form can preview the resulting link
 * as the admin types -- a `"use server"` file may only export async functions.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
