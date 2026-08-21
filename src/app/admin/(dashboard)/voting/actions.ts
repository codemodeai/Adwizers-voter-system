"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import type { VotingStatus } from "@/lib/voting";

export type VotingResult = { ok: boolean; error?: string };

const VALID: VotingStatus[] = ["not_started", "open", "paused", "stopped"];

/** Every screen that reports voting state, plus every public category page. */
function revalidateVoting() {
  revalidatePath("/admin/voting");
  revalidatePath("/admin/categories");
  revalidatePath("/vote", "layout");
}

/**
 * Moves the global voting switch (Final Plan section 10, manual variant).
 *
 * Nothing changes this on a timer: voting opens when an admin opens it and
 * ends when an admin stops it. Stopping is reversible -- no vote data is
 * touched by it -- but the UI asks first, because reopening a vote that has
 * been announced as closed is a decision, not a click.
 */
export async function setVotingStatus(status: VotingStatus): Promise<VotingResult> {
  const { supabase, user } = await requireAdmin();

  if (!VALID.includes(status)) return { ok: false, error: "Unknown voting status." };

  const { error } = await supabase
    .from("voting_settings")
    .update({ status, updated_by: user.id })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  revalidateVoting();
  return { ok: true };
}

/**
 * Pauses or resumes one category while the rest keep running.
 *
 * Separate from hiding the category: this leaves the page and its nominee
 * cards up and only stops votes being cast, which is what you want when one
 * category needs looking at and the others should carry on.
 *
 * It has no effect unless global voting is open -- that is a property of how
 * the state is derived, not a rule enforced here, so a category can be pre-
 * paused before voting starts and will simply stay paused when it does.
 */
export async function setCategoryVotingPaused(
  id: number,
  paused: boolean,
): Promise<VotingResult> {
  const { supabase } = await requireAdmin();

  const { data: category } = await supabase
    .from("categories")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  if (!category) return { ok: false, error: "Category not found." };

  const { error } = await supabase
    .from("categories")
    .update({ voting_paused: paused })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidateVoting();
  revalidatePath(`/vote/${category.slug}`);
  return { ok: true };
}

/**
 * Pauses or resumes every category at once.
 *
 * The per-category switches are what make this necessary: after holding four
 * categories individually, "resume everything" should not mean fourteen
 * clicks.
 */
export async function setAllCategoriesPaused(paused: boolean): Promise<VotingResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("categories")
    .update({ voting_paused: paused })
    .neq("id", 0); // PostgREST requires a filter on bulk updates.

  if (error) return { ok: false, error: error.message };

  revalidateVoting();
  return { ok: true };
}
