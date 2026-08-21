"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { categoryStandings } from "@/lib/results";

export type ResultsActionResult = { ok: boolean; error?: string; notice?: string };

function revalidateResults() {
  revalidatePath("/admin/results");
  revalidatePath("/admin/analytics");
  revalidatePath("/winners");
}

/**
 * Reveal (Final Plan section 11).
 *
 * Writes a snapshot of the Top 5 per category rather than making the winner
 * page query votes live. Two reasons, both load-bearing: section 9 keeps vote
 * counts off every public route, and a published result should not silently
 * change afterwards -- if a vote were somehow removed later, the announced
 * winners must stay the announced winners.
 *
 * Refuses while voting is still running, because section 11 makes reveal an
 * action taken "once voting closes".
 */
export async function publishResults(): Promise<ResultsActionResult> {
  const { supabase, user } = await requireAdmin();

  const { data: settings } = await supabase
    .from("voting_settings")
    .select("status")
    .eq("id", 1)
    .maybeSingle<{ status: string }>();

  if (!settings) return { ok: false, error: "Voting settings not found." };

  if (settings.status !== "stopped") {
    return {
      ok: false,
      error: "Stop voting first — results can only be revealed once voting has closed.",
    };
  }

  const standings = await categoryStandings();

  const rows = standings.flatMap((category) =>
    category.rows
      // A nominee with no votes is not a winner. Publishing her at rank 5
      // because nobody else stood would announce something untrue.
      .filter((row) => row.votes > 0)
      .map((row) => ({
        category_id: category.categoryId,
        nominee_id: row.nomineeId,
        rank: row.rank,
      })),
  );

  if (rows.length === 0) {
    return { ok: false, error: "No votes have been cast, so there is nothing to reveal." };
  }

  // Replace wholesale: re-revealing should reflect the current standings, not
  // merge into a previous snapshot.
  const { error: clearError } = await supabase
    .from("published_winners")
    .delete()
    .neq("id", 0);

  if (clearError) return { ok: false, error: clearError.message };

  const { error: insertError } = await supabase.from("published_winners").insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  const { error: markError } = await supabase
    .from("voting_settings")
    .update({ results_published_at: new Date().toISOString(), results_published_by: user.id })
    .eq("id", 1);

  if (markError) return { ok: false, error: markError.message };

  revalidateResults();
  return {
    ok: true,
    notice: `Published ${rows.length} winner${rows.length === 1 ? "" : "s"} across ${standings.filter((c) => c.rows.some((r) => r.votes > 0)).length} categories.`,
  };
}

/**
 * Takes the winner page back down.
 *
 * Deletes the snapshot as well as clearing the timestamp, so an unpublished
 * result cannot be half-visible through a stale row.
 */
export async function unpublishResults(): Promise<ResultsActionResult> {
  const { supabase } = await requireAdmin();

  const { error: clearError } = await supabase.from("published_winners").delete().neq("id", 0);
  if (clearError) return { ok: false, error: clearError.message };

  const { error } = await supabase
    .from("voting_settings")
    .update({ results_published_at: null, results_published_by: null })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  revalidateResults();
  return { ok: true, notice: "Winner page taken down." };
}
