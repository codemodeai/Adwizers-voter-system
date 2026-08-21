import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

/**
 * The voting switch. Manual throughout -- nothing here moves on a timer, so
 * voting opens and stops only when an admin says so.
 */
export type VotingStatus = "not_started" | "open" | "paused" | "stopped";

export const VOTING_STATUSES: VotingStatus[] = ["not_started", "open", "paused", "stopped"];

export const VOTING_STATUS_LABEL: Record<VotingStatus, string> = {
  not_started: "Not started",
  open: "Voting open",
  paused: "Voting paused",
  stopped: "Voting stopped",
};

export type VotingSettings = { status: VotingStatus };

/**
 * A single category's effective state, which is the global switch narrowed by
 * that category's own two flags.
 *
 * `hidden` and `paused` are deliberately different things: hiding closes the
 * page altogether, pausing leaves the cards up and only stops votes. Both are
 * only meaningful while voting is globally open -- once it is stopped, every
 * category is stopped regardless.
 */
export type CategoryVotingState = VotingStatus | "hidden" | "category_paused";

export const CATEGORY_STATE_LABEL: Record<CategoryVotingState, string> = {
  ...VOTING_STATUS_LABEL,
  hidden: "Page hidden",
  category_paused: "Paused for this category",
};

export function categoryVotingState(
  status: VotingStatus,
  category: { is_active: boolean; voting_paused: boolean },
): CategoryVotingState {
  if (!category.is_active) return "hidden";
  if (status !== "open") return status;
  return category.voting_paused ? "category_paused" : "open";
}

/** The single question the ballot will ask, once it exists. */
export function canVoteIn(
  status: VotingStatus,
  category: { is_active: boolean; voting_paused: boolean },
): boolean {
  return categoryVotingState(status, category) === "open";
}

const DEFAULT: VotingSettings = { status: "not_started" };

/** Admin read, through the signed-in admin's session. */
export async function getVotingSettings(): Promise<VotingSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voting_settings")
    .select("status")
    .eq("id", 1)
    .maybeSingle();

  return (data as VotingSettings | null) ?? DEFAULT;
}

/**
 * Public read for the category voting page.
 *
 * Falls back to "not started" rather than throwing when the row or table is
 * missing, so a voting page never breaks over a settings read -- it reports
 * that voting has not opened, which is the safe direction to be wrong in.
 */
export async function getPublicVotingSettings(): Promise<VotingSettings> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("voting_settings")
    .select("status")
    .eq("id", 1)
    .maybeSingle();

  return (data as VotingSettings | null) ?? DEFAULT;
}
