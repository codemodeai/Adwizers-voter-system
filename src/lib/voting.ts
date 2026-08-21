import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type VotingSettings = {
  starts_at: string | null;
  ends_at: string | null;
  is_paused: boolean;
};

/**
 * Where voting stands right now.
 *
 * Derived, never stored. Section 10's "voting auto-locks the moment the end
 * time hits" is satisfied by computing this on every read: there is no job to
 * fire, miss, or retry, and a window that expired overnight is already closed
 * the first time anyone looks.
 */
export type VotingState =
  | "unscheduled"
  | "scheduled"
  | "open"
  | "paused"
  | "closed";

export const VOTING_STATE_LABEL: Record<VotingState, string> = {
  unscheduled: "Not scheduled",
  scheduled: "Opens later",
  open: "Voting open",
  paused: "Paused",
  closed: "Voting closed",
};

export function votingState(settings: VotingSettings, now = new Date()): VotingState {
  const { starts_at, ends_at, is_paused } = settings;

  if (!starts_at || !ends_at) return "unscheduled";

  const start = new Date(starts_at);
  const end = new Date(ends_at);

  // Closed wins over paused: once the window has passed, "paused" would imply
  // it could still be resumed, which it cannot without moving the dates.
  if (now >= end) return "closed";
  if (now < start) return "scheduled";
  if (is_paused) return "paused";
  return "open";
}

/** Whether a vote may be cast this instant. The single question the ballot
 *  will ask; everything else here is presentation. */
export function votingIsOpen(settings: VotingSettings, now = new Date()): boolean {
  return votingState(settings, now) === "open";
}

const EMPTY: VotingSettings = { starts_at: null, ends_at: null, is_paused: false };

/** Admin read, through the signed-in admin's session. */
export async function getVotingSettings(): Promise<VotingSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voting_settings")
    .select("starts_at, ends_at, is_paused")
    .eq("id", 1)
    .maybeSingle();

  return (data as VotingSettings | null) ?? EMPTY;
}

/**
 * Public read for the category voting page.
 *
 * Falls back to "unscheduled" rather than throwing when the row or table is
 * missing, so a voting page never breaks over a settings read -- it just
 * reports that voting has not been scheduled.
 */
export async function getPublicVotingSettings(): Promise<VotingSettings> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("voting_settings")
    .select("starts_at, ends_at, is_paused")
    .eq("id", 1)
    .maybeSingle();

  return (data as VotingSettings | null) ?? EMPTY;
}

/**
 * Dates are shown in IST everywhere, labelled as such.
 *
 * The client and every applicant are in India, and a voting deadline that
 * silently renders in the reader's own zone is the kind of thing that gets
 * someone locked out an hour early.
 */
export function formatIst(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
