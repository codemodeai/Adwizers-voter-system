"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import {
  clearOriginals,
  extensionFor,
  keepOriginal,
  photoStorage,
  restoreOriginal,
} from "@/lib/photoStorage";
import { validateLogoFile } from "@/lib/validation/applicant";
import type { NomineeEditState, NomineePhotoState } from "./state";

/** Photos the nominee owns live here. Anything outside this prefix is the
 *  applicant's original upload, shared by reference and never deleted from a
 *  nominee screen. */
const NOMINEE_PREFIX = "nominees/";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Edits the public-facing profile (Final Plan section 4: the nominee's own edit
 * screen, "separate from the original Applicant submission ... without touching
 * the original form data").
 *
 * Nothing here writes to the applicants table. That is the whole point of the
 * separation, and it is worth stating plainly: polishing a bio for the voting
 * page must never rewrite what she actually submitted on Form 1.
 */
export async function updateNominee(
  _prev: NomineeEditState,
  formData: FormData,
): Promise<NomineeEditState> {
  const { supabase } = await requireAdmin();

  const id = text(formData, "id");
  if (!id) return { status: "error", message: "Missing nominee id." };

  const { data: current } = await supabase
    .from("nominees")
    .select("id, categories(slug)")
    .eq("id", id)
    .maybeSingle<{ id: string; categories: { slug: string } | null }>();

  if (!current) return { status: "error", message: "Nominee not found." };

  const fieldErrors: Record<string, string> = {};

  const displayName = text(formData, "display_name");
  const businessName = text(formData, "business_name");
  const categoryId = Number(text(formData, "category_id"));

  if (!displayName) fieldErrors.display_name = "Name cannot be empty";
  if (!businessName) fieldErrors.business_name = "Business name cannot be empty";
  if (!categoryId) fieldErrors.category_id = "Choose a category";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }

  const { error } = await supabase
    .from("nominees")
    .update({
      display_name: displayName,
      business_name: businessName,
      category_id: categoryId,
      area_location: nullableText(formData, "area_location"),
      bio: nullableText(formData, "bio"),
      social_instagram: normalizeUrl(nullableText(formData, "social_instagram")),
      social_facebook: normalizeUrl(nullableText(formData, "social_facebook")),
      social_website: normalizeUrl(nullableText(formData, "social_website")),
      social_whatsapp: normalizeUrl(nullableText(formData, "social_whatsapp")),
      is_published: formData.get("is_published") === "on",
    })
    .eq("id", id);

  if (error) return { status: "error", message: `Could not save: ${error.message}` };

  // A category move changes two public pages, not one.
  const { data: after } = await supabase
    .from("nominees")
    .select("categories(slug)")
    .eq("id", id)
    .maybeSingle<{ categories: { slug: string } | null }>();

  revalidatePath("/admin/nominees");
  revalidatePath(`/admin/nominees/${id}`);
  revalidatePath("/admin/categories");
  if (current.categories?.slug) revalidatePath(`/vote/${current.categories.slug}`);
  if (after?.categories?.slug) revalidatePath(`/vote/${after.categories.slug}`);

  return { status: "saved", message: "Profile saved." };
}

/**
 * Replaces or removes the nominee's public photo.
 *
 * The delicate part is removal. A freshly promoted nominee points at the
 * applicant's *own* uploaded logo -- the same object, shared by reference --
 * so deleting it here would quietly destroy part of her original submission.
 * Only objects this screen wrote, under `nominees/`, are ever deleted from
 * storage; anything else is merely unlinked.
 */
export async function updateNomineePhoto(
  _prev: NomineePhotoState,
  formData: FormData,
): Promise<NomineePhotoState> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "replace");
  if (!id) return { status: "error", message: "Missing nominee id." };

  const { data: nominee } = await supabase
    .from("nominees")
    .select("photo_path, categories(slug)")
    .eq("id", id)
    .maybeSingle<{ photo_path: string | null; categories: { slug: string } | null }>();

  if (!nominee) return { status: "error", message: "Nominee not found." };

  const storage = photoStorage();
  const owned = (path: string | null) => Boolean(path?.startsWith(NOMINEE_PREFIX));
  // Undo copies for this nominee sit beside her own photo, never in the
  // applicant's folder -- her screen must not write into the original entry.
  const folder = `${NOMINEE_PREFIX}${id}`;

  const done = (message: string): NomineePhotoState => {
    revalidatePath(`/admin/nominees/${id}`);
    revalidatePath("/admin/nominees");
    revalidatePath("/admin/categories");
    if (nominee.categories?.slug) revalidatePath(`/vote/${nominee.categories.slug}`);
    return { status: "saved", message };
  };

  if (intent === "remove") {
    if (owned(nominee.photo_path)) await storage.remove([nominee.photo_path!]);
    await clearOriginals(folder);
    await supabase.from("nominees").update({ photo_path: null }).eq("id", id);
    return done("Photo removed.");
  }

  // Undo a crop taken on this screen.
  if (intent === "restore") {
    const restored = await restoreOriginal(
      folder,
      (extension) => `${folder}/photo.${extension}`,
    );
    if ("error" in restored) return { status: "error", message: restored.error };

    if (owned(nominee.photo_path) && nominee.photo_path !== restored.path) {
      await storage.remove([nominee.photo_path!]);
    }

    await supabase.from("nominees").update({ photo_path: restored.path }).eq("id", id);
    return done("Original photo restored.");
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image to upload." };
  }

  const invalid = validateLogoFile(file);
  if (invalid) return { status: "error", message: invalid };

  const path = `${folder}/photo.${extensionFor(file.type)}`;

  const { error: uploadError } = await storage.upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return { status: "error", message: uploadError.message };

  // Clean up only a previous nominee-owned object at a different extension.
  if (owned(nominee.photo_path) && nominee.photo_path !== path) {
    await storage.remove([nominee.photo_path!]);
  }

  // Posted only when this file came out of the cropper.
  const source = formData.get("photo_original");
  if (source instanceof File && source.size > 0 && !validateLogoFile(source)) {
    await keepOriginal(folder, source);
  } else {
    await clearOriginals(folder);
  }

  await supabase.from("nominees").update({ photo_path: path }).eq("id", id);
  return done("Photo updated.");
}
