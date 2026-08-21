"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { slugify, type CategoryFormState } from "./state";

export type CategoryResult = { ok: boolean; error?: string; notice?: string };

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateCategories(slugs: (string | null | undefined)[] = []) {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/nominees");
  revalidatePath("/register");
  for (const slug of slugs) if (slug) revalidatePath(`/vote/${slug}`);
}

/**
 * Adds a category (Final Plan section 5).
 *
 * The 14 from section 15 are seeded and locked by the plan, so this exists for
 * what comes after -- a category the client adds mid-cycle. It gets its own
 * shareable link the moment it is created.
 */
export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { supabase } = await requireAdmin();

  const name = text(formData, "name");
  if (!name) return { status: "error", message: "Give the category a name." };

  const slug = slugify(text(formData, "slug") || name);
  if (!slug) return { status: "error", message: "That name has no usable link slug." };

  // New categories go to the end of the list rather than the top.
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("categories").insert({
    name,
    slug,
    sort_order: (last?.sort_order ?? 0) + 1,
    is_active: true,
  });

  if (error) {
    // Both name and slug are unique; say which one clashed rather than leaking
    // the constraint name.
    if (error.code === "23505") {
      return {
        status: "error",
        message: error.message.includes("slug")
          ? `The link /vote/${slug} is already taken.`
          : `A category called "${name}" already exists.`,
      };
    }
    return { status: "error", message: error.message };
  }

  revalidateCategories([slug]);
  return { status: "saved", message: `Added "${name}".` };
}

/**
 * Renames a category, and optionally changes its link.
 *
 * Changing the slug is the one genuinely destructive edit on this screen: it is
 * the address on every poster and WhatsApp forward that has already gone out,
 * and the old one stops resolving the moment this saves. The UI asks for
 * confirmation; this records what happened so the notice can say so.
 */
export async function updateCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { supabase } = await requireAdmin();

  const id = Number(text(formData, "id"));
  if (!id) return { status: "error", message: "Missing category." };

  const name = text(formData, "name");
  if (!name) return { status: "error", message: "Give the category a name." };

  const { data: current } = await supabase
    .from("categories")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  if (!current) return { status: "error", message: "Category not found." };

  const slug = slugify(text(formData, "slug") || name);
  if (!slug) return { status: "error", message: "That name has no usable link slug." };

  const { error } = await supabase.from("categories").update({ name, slug }).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: error.message.includes("slug")
          ? `The link /vote/${slug} is already taken.`
          : `A category called "${name}" already exists.`,
      };
    }
    return { status: "error", message: error.message };
  }

  revalidateCategories([current.slug, slug]);

  return {
    status: "saved",
    message:
      slug === current.slug
        ? "Category saved."
        : `Saved. The link is now /vote/${slug} — /vote/${current.slug} no longer works.`,
  };
}

/**
 * Shows or hides a category.
 *
 * Deliberately not a delete: `on delete restrict` on both applicants and
 * nominees means a category anyone has ever entered cannot be removed, which is
 * the correct answer for live data. Hiding takes it off the entry form and
 * closes its voting page while leaving every entry intact.
 */
export async function setCategoryActive(
  id: number,
  active: boolean,
): Promise<CategoryResult> {
  const { supabase } = await requireAdmin();

  const { data: category } = await supabase
    .from("categories")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  if (!category) return { ok: false, error: "Category not found." };

  const { error } = await supabase
    .from("categories")
    .update({ is_active: active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidateCategories([category.slug]);
  return { ok: true };
}

/**
 * Moves a category one place in the shared order -- which is the order the
 * entry form's dropdown and the Categories screen both use.
 *
 * Same swap-two-values approach as the nominee reorder, for the same reason:
 * renumbering the whole table on every click would make two admins reordering
 * at once fight each other.
 */
export async function moveCategory(
  id: number,
  direction: "up" | "down",
): Promise<CategoryResult> {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("categories")
    .select("id, sort_order, slug")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const ordered = (data ?? []) as { id: number; sort_order: number; slug: string }[];
  const index = ordered.findIndex((c) => c.id === id);
  if (index === -1) return { ok: false, error: "Category not found." };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return { ok: true };

  const clashes = ordered[index].sort_order === ordered[target].sort_order;
  const positions = clashes
    ? ordered.map((_, i) => i + 1)
    : ordered.map((c) => c.sort_order);

  [positions[index], positions[target]] = [positions[target], positions[index]];

  const results = await Promise.all(
    ordered.map((c, i) =>
      supabase.from("categories").update({ sort_order: positions[i] }).eq("id", c.id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidateCategories();
  return { ok: true };
}
