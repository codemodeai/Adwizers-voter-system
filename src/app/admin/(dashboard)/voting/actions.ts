"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import type { VotingFormState } from "./state";

export type VotingResult = { ok: boolean; error?: string };

/**
 * Every voting page plus the two admin screens that report the state.
 *
 * The category pages are `force-dynamic`, so they pick the new state up on the
 * next request regardless -- these calls are what make the dashboard itself
 * agree immediately.
 */
function revalidateVoting() {
  revalidatePath("/admin/voting");
  revalidatePath("/admin/categories");
  revalidatePath("/vote", "layout");
}

function isoOrNull(formData: FormData, key: string): string | null | undefined {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;

  const parsed = new Date(raw);
  // `undefined` distinguishes "the browser sent something unparseable" from
  // "the admin deliberately cleared this field".
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Sets the voting window (Final Plan section 10).
 *
 * The form posts ISO strings computed in the admin's own browser, because a
 * bare `datetime-local` value carries no offset -- the server would have to
 * guess a timezone, and guessing wrong moves a deadline by hours.
 */
export async function setVotingWindow(
  _prev: VotingFormState,
  formData: FormData,
): Promise<VotingFormState> {
  const { supabase, user } = await requireAdmin();

  const startsAt = isoOrNull(formData, "starts_at");
  const endsAt = isoOrNull(formData, "ends_at");

  if (startsAt === undefined || endsAt === undefined) {
    return { status: "error", message: "That date could not be read. Please re-enter it." };
  }

  // Half a window is not a schedule -- it would leave voting either never
  // opening or never closing, and the second one is the dangerous direction.
  if ((startsAt && !endsAt) || (!startsAt && endsAt)) {
    return {
      status: "error",
      message: "Set both a start and an end. A window with only one end never closes.",
    };
  }

  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return { status: "error", message: "Voting must end after it starts." };
  }

  const { error } = await supabase
    .from("voting_settings")
    .update({ starts_at: startsAt, ends_at: endsAt, updated_by: user.id })
    .eq("id", 1);

  if (error) return { status: "error", message: `Could not save: ${error.message}` };

  revalidateVoting();

  return {
    status: "saved",
    message: startsAt ? "Voting window saved." : "Voting window cleared.",
  };
}

/**
 * Pause / resume, independent of the schedule (section 10).
 *
 * Pausing deliberately does not touch the dates, so resuming returns to exactly
 * the window that was already set rather than to a shifted one.
 */
export async function setVotingPaused(paused: boolean): Promise<VotingResult> {
  const { supabase, user } = await requireAdmin();

  const { error } = await supabase
    .from("voting_settings")
    .update({ is_paused: paused, updated_by: user.id })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  revalidateVoting();
  return { ok: true };
}
