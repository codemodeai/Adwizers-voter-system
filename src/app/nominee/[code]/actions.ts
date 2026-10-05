"use server";

import { randomBytes } from "node:crypto";

import { checkRateLimits, logAttempt } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseNomineeCode, publicNomineePage } from "@/lib/nominees";
import { normaliseMobile } from "@/lib/phone";
import { createPublicClient } from "@/lib/supabase/public";
import { verifyTurnstile } from "@/lib/turnstile";
import { callerIp, ensureDeviceId, hashIp } from "@/lib/voter";
import { categoryVotingState, getRuntimeVotingConfig } from "@/lib/voting";
import type { VoteOutcome, VoteState } from "./state";

/**
 * The vote submission sequence (Final Plan section 8), in order:
 *
 *   1. rate limit -- server-side, first, cheapest
 *   2. Turnstile  -- before any database row is touched
 *   3. save       -- checked against the duplicate rules on the votes table
 *
 * Nothing is sent to the voter and nothing is verified: there is no emailed
 * code (removed at the client's request). What holds a voter to one vote per
 * nominee is the two unique indexes on the votes table -- mobile number
 * (required) and email (only when one is given) -- plus the rate limits above
 * them. Name and mobile are the only required fields.
 *
 * There is deliberately no per-device rule (dropped at the client's request):
 * a family sharing one phone can each vote for the same nominee. The device id
 * is still recorded and still feeds the hourly per-device rate limit.
 *
 * The mobile is reduced to one standard form (+919876543210) before it is
 * compared or stored -- see `@/lib/phone` -- so typing the same number with
 * spaces, a 0 or a +91 does not make it a different voter.
 *
 * Votes are cast only from a nominee's personal page (/nominee/AWE2026-007),
 * which posts her number. The category and nominee are resolved from that
 * number on the server -- see `readBallot`. Category-wide voting pages were
 * withdrawn at the client's request, so a submission without a nominee number
 * is refused as a closed page.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Parsed = {
  nomineeIds: string[];
  name: string;
  /** Standard form (+919876543210), or empty when the number was unusable --
   *  in which case `mobileError` says why. */
  mobile: string;
  mobileError?: string;
  /** Optional: lower-cased when given, empty when left blank. */
  email: string;
  location: string;
  token: string | null;
  deviceId: string;
};

function parse(formData: FormData): Parsed {
  // Reduced to one standard form before anything compares or stores it, so the
  // same phone typed five ways is still one voter.
  const mobile = normaliseMobile(String(formData.get("voter_mobile") ?? ""));

  return {
    // Filled in by `readBallot` from the nominee number -- never taken from
    // the form, so a submission cannot name a nominee directly.
    nomineeIds: [],
    name: String(formData.get("voter_name") ?? "").trim(),
    mobile: mobile.ok ? mobile.mobile : "",
    mobileError: mobile.ok ? undefined : mobile.error,
    email: String(formData.get("voter_email") ?? "").trim().toLowerCase(),
    location: String(formData.get("voter_location") ?? "").trim(),
    token: (String(formData.get("cf-turnstile-response") ?? "").trim() || null),
    deviceId: String(formData.get("device_id") ?? "").trim(),
  };
}

/**
 * Which nominee this submission is for.
 *
 * The personal page sends only the nominee's number, and everything else is
 * looked up here: her id, and her category's slug for the gate. Nothing the
 * browser says about either is trusted. No number, or one that does not
 * resolve to a live nominee, leaves the slug empty -- which the gate refuses
 * as a closed page. That includes anything still posting the old category-page
 * form.
 */
async function readBallot(formData: FormData): Promise<{ slug: string; input: Parsed }> {
  const input = parse(formData);
  const rawCode = formData.get("nominee_code");

  if (typeof rawCode !== "string") return { slug: "", input };

  const code = normaliseNomineeCode(rawCode);
  const page = code ? await publicNomineePage(code) : null;

  return {
    slug: page?.category.slug ?? "",
    input: { ...input, nomineeIds: page ? [page.nominee.id] : [] },
  };
}

function validate(input: Parsed): string | null {
  if (input.nomineeIds.length === 0) return "This nominee's voting page is closed.";
  if (!input.name) return "Please enter your name.";
  // The mobile has already been reduced to its standard form in `readBallot`;
  // an empty value here means it was not a usable number.
  if (!input.mobile) return input.mobileError ?? "Please enter a valid mobile number.";
  // Optional -- but if one is typed, it has to look like an email address.
  if (input.email && !EMAIL.test(input.email)) return "Please check your email address, or leave it blank.";
  return null;
}

/** Short, unambiguous receipt. No 0/O or 1/I, because these get read aloud and
 *  typed back. */
function voteRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `AWE-${out}`;
}

/**
 * Everything that must be true before a vote is accepted, in plan order.
 * Returns the category and the caller's signals, or the reason to refuse.
 */
type GateResult =
  | { ok: false; error: string; field?: "selection" | "details" }
  | {
      ok: true;
      category: { id: number; name: string };
      rules: Awaited<ReturnType<typeof getRuntimeVotingConfig>>;
      deviceId: string;
      ipHash: string | null;
    };

async function gate(slug: string, input: Parsed): Promise<GateResult> {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem, field: "details" };

  const supabase = createPublicClient();

  const { data: categoryRow } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const category = categoryRow as
    | { id: number; name: string; voting_paused?: boolean }
    | null;

  if (!category) return { ok: false, error: "This voting page is closed." };

  const rules = await getRuntimeVotingConfig();
  const state = categoryVotingState(rules.status, {
    is_active: true,
    voting_paused: category.voting_paused ?? false,
  });

  if (state !== "open") {
    return {
      ok: false,
      error:
        state === "category_paused"
          ? "Voting is paused for this category right now."
          : state === "paused"
            ? "Voting is paused right now."
            : state === "stopped"
              ? "Voting has closed."
              : "Voting has not opened yet.",
    };
  }

  const deviceId = await ensureDeviceId(input.deviceId);
  const ip = await callerIp();
  const ipHash = hashIp(ip);

  // 1. Rate limit -- first and cheapest.
  const limited = await checkRateLimits({
    ipHash,
    deviceId,
    perIpPerMinute: rules.rate_limit_per_ip_per_minute,
    perDevicePerHour: rules.rate_limit_per_device_per_hour,
  });

  if (!limited.ok) {
    await logAttempt({
      categoryId: category.id,
      matchedSignal: "rate_limit",
      voterMobile: input.mobile,
      voterEmail: input.email || null,
      deviceId,
      ipHash,
    });
    return { ok: false, error: limited.error };
  }

  if (
    rules.max_selections_per_submit !== null &&
    input.nomineeIds.length > rules.max_selections_per_submit
  ) {
    return {
      ok: false,
      error: `You can vote for up to ${rules.max_selections_per_submit} nominees at a time.`,
      field: "selection",
    };
  }

  // 2. Turnstile -- before a row is written.
  const captcha = await verifyTurnstile(input.token, ip);
  if (!captcha.ok) {
    await logAttempt({
      categoryId: category.id,
      matchedSignal: "captcha",
      voterMobile: input.mobile,
      voterEmail: input.email || null,
      deviceId,
      ipHash,
    });
    return { ok: false, error: captcha.reason };
  }

  return { ok: true, category, rules, deviceId, ipHash };
}

/**
 * Writes one row per nominee, each checked independently against the database's
 * unique rules: one vote per nominee per mobile number and per email.
 *
 * Explicitly not a transaction, and not a bulk insert. Section 6 requires that
 * nominees which pass are recorded while nominees that clash are skipped, in
 * the same submission -- a single statement would roll the whole batch back on
 * the first duplicate.
 */
async function castVotes(params: {
  nomineeIds: string[];
  categoryId: number;
  input: Parsed;
  deviceId: string;
  ipHash: string | null;
}): Promise<VoteOutcome[]> {
  const supabase = createAdminClient();

  // Only nominees actually published in this category. A tampered form cannot
  // vote for someone on another page, or for a hidden profile.
  const { data: eligible } = await supabase
    .from("nominees")
    .select("id, display_name")
    .eq("category_id", params.categoryId)
    .eq("is_published", true)
    .in("id", params.nomineeIds);

  const allowed = (eligible ?? []) as { id: string; display_name: string }[];
  const outcomes: VoteOutcome[] = [];

  for (const nominee of allowed) {
    const { error } = await supabase.from("votes").insert({
      nominee_id: nominee.id,
      category_id: params.categoryId,
      voter_name: params.input.name,
      voter_mobile: params.input.mobile,
      // NULL rather than "" when blank: NULLs never clash in the unique index,
      // so voters without an email are limited by mobile number alone.
      voter_email: params.input.email || null,
      voter_location: params.input.location || null,
      device_id: params.deviceId,
      ip_hash: params.ipHash,
      vote_ref: voteRef(),
    });

    if (!error) {
      outcomes.push({ nomineeId: nominee.id, name: nominee.display_name, status: "recorded" });
      continue;
    }

    // 23505 is a unique violation -- this mobile number or this email already
    // has a vote for this nominee. Anything else is a real failure. ("device"
    // remains only for a database where the device rule has not been dropped
    // yet.)
    if (error.code === "23505") {
      const signal = error.message.includes("email")
        ? "email"
        : error.message.includes("mobile")
          ? "mobile"
          : "device";

      await logAttempt({
        nomineeId: nominee.id,
        categoryId: params.categoryId,
        matchedSignal: signal,
        voterMobile: params.input.mobile,
        voterEmail: params.input.email || null,
        deviceId: params.deviceId,
        ipHash: params.ipHash,
      });

      outcomes.push({ nomineeId: nominee.id, name: nominee.display_name, status: "already" });
    } else {
      outcomes.push({ nomineeId: nominee.id, name: nominee.display_name, status: "failed" });
    }
  }

  // Re-read the receipts in one go rather than returning the generated values,
  // so what the voter is shown is what the database actually holds.
  const recordedIds = outcomes.filter((o) => o.status === "recorded").map((o) => o.nomineeId);
  if (recordedIds.length > 0) {
    const { data: refs } = await supabase
      .from("votes")
      .select("nominee_id, vote_ref")
      // By mobile, the one contact detail every vote carries.
      .eq("voter_mobile", params.input.mobile)
      .in("nominee_id", recordedIds);

    const byNominee = new Map(
      ((refs ?? []) as { nominee_id: string; vote_ref: string }[]).map((r) => [
        r.nominee_id,
        r.vote_ref,
      ]),
    );
    for (const outcome of outcomes) {
      if (outcome.status === "recorded") outcome.voteRef = byNominee.get(outcome.nomineeId);
    }
  }

  return outcomes;
}

/**
 * The one entry point: validate, rate-limit, check the captcha, then record the
 * vote. A server action is an addressable endpoint, so every check runs here
 * on every call rather than trusting anything the page did first.
 */
export async function submitVote(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const { slug, input } = await readBallot(formData);

  const checked = await gate(slug, input);
  if (!checked.ok) {
    return { status: "error", message: checked.error, field: checked.field };
  }

  const outcomes = await castVotes({
    nomineeIds: input.nomineeIds,
    categoryId: checked.category.id,
    input,
    deviceId: checked.deviceId,
    ipHash: checked.ipHash,
  });

  return { status: "done", outcomes };
}
