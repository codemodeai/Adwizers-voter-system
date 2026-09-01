"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { notifyNominee } from "@/lib/email/notify";

export type NomineeActionResult = { ok: boolean; error?: string; notice?: string };

/** Every surface a nominee change can show up on. */
function revalidateNominee(id: string, slug?: string | null) {
  revalidatePath("/admin/nominees");
  revalidatePath(`/admin/nominees/${id}`);
  revalidatePath("/admin/categories");
  if (slug) revalidatePath(`/vote/${slug}`);
}

/**
 * Publish / unpublish (Final Plan section 5).
 *
 * Unpublishing takes the card off the category page without deleting anything
 * -- the profile, the notification trail, and the link back to her original
 * entry all survive, so it can be reversed with one click.
 */
export async function setNomineePublished(
  id: string,
  published: boolean,
): Promise<NomineeActionResult> {
  const { supabase } = await requireAdmin();

  const { data: nominee } = await supabase
    .from("nominees")
    .select("id, categories(slug)")
    .eq("id", id)
    .maybeSingle<{ id: string; categories: { slug: string } | null }>();

  if (!nominee) return { ok: false, error: "Nominee not found." };

  const { error } = await supabase
    .from("nominees")
    .update({ is_published: published })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidateNominee(id, nominee.categories?.slug);
  return { ok: true };
}

/**
 * Sends the selection email again -- for the ones that were promoted before
 * Resend was configured, that bounced, or that had no address on file at the
 * time and have since been given one.
 *
 * The address is read from the applicant, not from `notify_email`, so fixing a
 * typo on the original entry is enough to make the resend work.
 */
export async function resendNomineeEmail(id: string): Promise<NomineeActionResult> {
  const { supabase } = await requireAdmin();

  const { data: nominee } = await supabase
    .from("nominees")
    // `*` so a resend still works against a database that predates the
    // nominee-number column; the email leaves the number out when it is absent.
    .select("*, applicants(email), categories(name, slug)")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      code?: string | null;
      display_name: string;
      business_name: string;
      applicants: { email: string | null } | null;
      categories: { name: string; slug: string } | null;
    }>();

  if (!nominee) return { ok: false, error: "Nominee not found." };
  if (!nominee.categories) return { ok: false, error: "Nominee has no category." };

  const problem = await notifyNominee(supabase, {
    nomineeId: nominee.id,
    code: nominee.code ?? null,
    email: nominee.applicants?.email ?? null,
    name: nominee.display_name,
    businessName: nominee.business_name,
    categoryName: nominee.categories.name,
    categorySlug: nominee.categories.slug,
  });

  revalidateNominee(id, nominee.categories.slug);

  if (problem) return { ok: false, error: problem };
  return { ok: true, notice: "Email sent." };
}

/**
 * Moves a nominee one place up or down within her category page.
 *
 * Written as a swap of two `sort_order` values rather than a renumbering of the
 * whole list, so two admins reordering at once cannot shuffle each other's
 * cards. Rows promoted before any ordering was set all share sort_order 0 and
 * fall back to created_at, so the first move seeds real values from the order
 * the page is already showing.
 */
export async function moveNominee(
  id: string,
  direction: "up" | "down",
): Promise<NomineeActionResult> {
  const { supabase } = await requireAdmin();

  const { data: nominee } = await supabase
    .from("nominees")
    .select("id, category_id, categories(slug)")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      category_id: number;
      categories: { slug: string } | null;
    }>();

  if (!nominee) return { ok: false, error: "Nominee not found." };

  // The category's cards in exactly the order the page renders them.
  const { data: siblings } = await supabase
    .from("nominees")
    .select("id, sort_order")
    .eq("category_id", nominee.category_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const ordered = (siblings ?? []) as { id: string; sort_order: number }[];
  const index = ordered.findIndex((n) => n.id === id);
  if (index === -1) return { ok: false, error: "Nominee not found in its category." };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return { ok: true };

  // Renumber only when the stored values cannot express a swap -- which is the
  // case while every row still holds the default 0.
  const needsSeeding = ordered[index].sort_order === ordered[target].sort_order;
  const positions = needsSeeding
    ? ordered.map((_, i) => i + 1)
    : ordered.map((n) => n.sort_order);

  [positions[index], positions[target]] = [positions[target], positions[index]];

  const updates = ordered.map((n, i) =>
    supabase.from("nominees").update({ sort_order: positions[i] }).eq("id", n.id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidateNominee(id, nominee.categories?.slug);
  return { ok: true };
}
