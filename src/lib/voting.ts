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

/**
 * Voting rules and security thresholds (Final Plan sections 5 and 8).
 *
 * Stored rather than hardcoded because the moment they matter most is during a
 * live vote, when tightening a limit has to take seconds rather than a deploy.
 */
export type VotingRules = {
  rate_limit_per_ip_per_minute: number;
  rate_limit_per_device_per_hour: number;
  /**
   * Whether the ballot emails a 6-digit code and holds the vote until it comes
   * back. Off by default: the duplicate-vote rules live on the votes table, so
   * they hold without it, and requiring a code makes voting depend on SES
   * being able to send. Turning it on is the deliberate act.
   */
  require_email_verification: boolean;
  /** Only consulted while verification is on. */
  verify_session_minutes: number;
  /** Null means no cap -- section 7 allows voting for every nominee in a
   *  category in one submission. */
  max_selections_per_submit: number | null;
  results_published_at: string | null;
};

/** The plan's own numbers (section 8), used when the row predates these columns. */
export const DEFAULT_RULES: VotingRules = {
  rate_limit_per_ip_per_minute: 3,
  rate_limit_per_device_per_hour: 20,
  require_email_verification: false,
  verify_session_minutes: 45,
  max_selections_per_submit: null,
  results_published_at: null,
};

export async function getVotingRules(): Promise<VotingRules> {
  const supabase = await createClient();
  // `*` so this keeps working against a database that predates these columns,
  // the same reason the category reads use it.
  const { data } = await supabase.from("voting_settings").select("*").eq("id", 1).maybeSingle();

  const row = (data ?? {}) as Partial<VotingRules>;

  return {
    rate_limit_per_ip_per_minute:
      row.rate_limit_per_ip_per_minute ?? DEFAULT_RULES.rate_limit_per_ip_per_minute,
    rate_limit_per_device_per_hour:
      row.rate_limit_per_device_per_hour ?? DEFAULT_RULES.rate_limit_per_device_per_hour,
    require_email_verification:
      row.require_email_verification ?? DEFAULT_RULES.require_email_verification,
    verify_session_minutes: row.verify_session_minutes ?? DEFAULT_RULES.verify_session_minutes,
    max_selections_per_submit: row.max_selections_per_submit ?? null,
    results_published_at: row.results_published_at ?? null,
  };
}

/**
 * Does the ballot ask for an emailed code? Read on its own by the voting page,
 * which needs it only to decide what the form promises the voter -- and with
 * the service role, because anon deliberately cannot see this row's thresholds.
 *
 * Falls back to "no" when the column or the row is missing: that is both the
 * default and the safe direction to be wrong in, since a page that wrongly
 * promised a code would leave a voter waiting for an email never coming.
 */
export async function emailVerificationRequired(): Promise<boolean> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data } = await supabase.from("voting_settings").select("*").eq("id", 1).maybeSingle();
  return ((data ?? {}) as Partial<VotingRules>).require_email_verification ?? false;
}

/** Dates are shown in IST everywhere, labelled as such -- the client and every
 *  applicant are in India. */
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

/**
 * Status and rules together, read with the service role.
 *
 * The public vote action needs the rate limits, and `anon` deliberately cannot
 * see them -- the column grant on voting_settings covers the switch and the
 * reveal timestamp only, because the thresholds are fraud settings. So the
 * ballot reads them the same way the entry form writes submissions: server-side
 * with the service key, never through the browser's identity.
 */
export async function getRuntimeVotingConfig(): Promise<VotingRules & { status: VotingStatus }> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data } = await supabase.from("voting_settings").select("*").eq("id", 1).maybeSingle();
  const row = (data ?? {}) as Partial<VotingRules> & { status?: VotingStatus };

  return {
    status: row.status ?? "not_started",
    rate_limit_per_ip_per_minute:
      row.rate_limit_per_ip_per_minute ?? DEFAULT_RULES.rate_limit_per_ip_per_minute,
    rate_limit_per_device_per_hour:
      row.rate_limit_per_device_per_hour ?? DEFAULT_RULES.rate_limit_per_device_per_hour,
    require_email_verification:
      row.require_email_verification ?? DEFAULT_RULES.require_email_verification,
    verify_session_minutes: row.verify_session_minutes ?? DEFAULT_RULES.verify_session_minutes,
    max_selections_per_submit: row.max_selections_per_submit ?? null,
    results_published_at: row.results_published_at ?? null,
  };
}
