"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { generateCode, sendVerificationCode } from "@/lib/email/verificationCode";
import { checkRateLimits, logAttempt } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  callerIp,
  ensureDeviceId,
  hashIp,
  startSession,
  verifiedSessionFor,
  verifyCode,
} from "@/lib/voteSession";
import { categoryVotingState, getRuntimeVotingConfig } from "@/lib/voting";
import type { VoteOutcome, VoteState } from "./state";

/**
 * The vote submission sequence (Final Plan section 8), in the order the plan
 * lays out and for the reasons it gives:
 *
 *   1. rate limit   -- server-side, first, cheapest
 *   2. Turnstile    -- before any email is sent or database row is touched
 *   3. verification -- one emailed code per session, not per vote
 *   4. save         -- one row per nominee, each checked independently
 *
 * Both entry points below run the same sequence; they differ only in whether a
 * code is being requested or supplied.
 *
 * Step 3 is now switchable, and off unless an admin turns it on
 * (`require_email_verification`). With it off the vote is cast straight after
 * the captcha, and what holds a voter to one vote per nominee is what always
 * did the work: the three unique indexes on the votes table (mobile, email,
 * device), plus the rate limits above them. The code proved the address was
 * hers; nothing else about the duplicate rules depended on it.
 */

const MOBILE = /^[+]?[\d\s-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Parsed = {
  nomineeIds: string[];
  name: string;
  mobile: string;
  email: string;
  location: string;
  token: string | null;
  deviceId: string;
};

function parse(formData: FormData): Parsed {
  return {
    nomineeIds: formData
      .getAll("nominee")
      .filter((v): v is string => typeof v === "string")
      // De-duplicated: a repeated id would otherwise clash with itself and be
      // reported back as "already voted for" in the same submission.
      .filter((v, i, all) => all.indexOf(v) === i),
    name: String(formData.get("voter_name") ?? "").trim(),
    mobile: String(formData.get("voter_mobile") ?? "").trim(),
    email: String(formData.get("voter_email") ?? "").trim().toLowerCase(),
    location: String(formData.get("voter_location") ?? "").trim(),
    token: (String(formData.get("cf-turnstile-response") ?? "").trim() || null),
    deviceId: String(formData.get("device_id") ?? "").trim(),
  };
}

function validate(input: Parsed): string | null {
  if (input.nomineeIds.length === 0) return "Choose at least one nominee to vote for.";
  if (!input.name) return "Please enter your name.";
  if (!input.mobile || !MOBILE.test(input.mobile)) return "Please enter a valid mobile number.";
  if (!input.email || !EMAIL.test(input.email)) return "Please enter a valid email address.";
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
      voterEmail: input.email,
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

  // 2. Turnstile -- before an email is sent or a row is written.
  const captcha = await verifyTurnstile(input.token, ip);
  if (!captcha.ok) {
    await logAttempt({
      categoryId: category.id,
      matchedSignal: "captcha",
      voterMobile: input.mobile,
      voterEmail: input.email,
      deviceId,
      ipHash,
    });
    return { ok: false, error: captcha.reason };
  }

  return { ok: true, category, rules, deviceId, ipHash };
}

/**
 * Writes one row per nominee, each checked independently against the database's
 * three unique rules (section 8).
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
      voter_email: params.input.email,
      voter_location: params.input.location || null,
      device_id: params.deviceId,
      ip_hash: params.ipHash,
      vote_ref: voteRef(),
    });

    if (!error) {
      outcomes.push({ nomineeId: nominee.id, name: nominee.display_name, status: "recorded" });
      continue;
    }

    // 23505 is a unique violation -- one of the three signals already has a
    // vote for this nominee. Anything else is a real failure.
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
        voterEmail: params.input.email,
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
      .eq("voter_email", params.input.email)
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
 * Step one: validate, rate-limit, check the captcha, then either cast the votes
 * (if this visit is already verified) or email a code.
 */
export async function startVote(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const slug = String(formData.get("slug") ?? "");
  const input = parse(formData);

  const checked = await gate(slug, input);
  if (!checked.ok) {
    return { status: "error", message: checked.error, field: checked.field };
  }

  const { category, rules, deviceId, ipHash } = checked;

  // Two ways past the code, and they are different facts: verification is
  // switched off altogether, or it is on and this visitor has already done it
  // (section 8 -- once per visit, across categories).
  const session = rules.require_email_verification
    ? await verifiedSessionFor(input.email)
    : null;

  if (!rules.require_email_verification || session) {
    const outcomes = await castVotes({
      nomineeIds: input.nomineeIds,
      categoryId: category.id,
      input,
      deviceId,
      ipHash,
    });
    revalidatePath(`/vote/${slug}`);
    return { status: "done", outcomes };
  }

  const code = generateCode();
  const started = await startSession({
    email: input.email,
    code,
    minutes: rules.verify_session_minutes,
    ipHash,
    deviceId,
  });

  if (!started.ok) return { status: "error", message: started.error };

  const sent = await sendVerificationCode({
    to: input.email,
    code,
    minutes: rules.verify_session_minutes,
  });

  if (sent.status === "failed") {
    return { status: "error", message: `Could not send your code: ${sent.error}` };
  }

  if (sent.status === "skipped") {
    return {
      status: "error",
      message:
        "Voting is not fully set up yet — verification codes cannot be sent. Please try again later.",
    };
  }

  return { status: "code_sent", email: input.email };
}

/**
 * Step two: check the emailed code, then cast the same selection.
 *
 * The whole gate runs again rather than trusting the first pass. A server
 * action is an addressable endpoint, so this one cannot assume `startVote` ran
 * before it, or that voting is still open since it did.
 */
export async function submitWithCode(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const slug = String(formData.get("slug") ?? "");
  const input = parse(formData);
  const code = String(formData.get("code") ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return { status: "code_sent", email: input.email, message: "Enter the 6-digit code." };
  }

  const checked = await gate(slug, input);
  if (!checked.ok) {
    return { status: "error", message: checked.error, field: checked.field };
  }

  // Verification can be switched off between a code being sent and it being
  // typed back. The already-sent code stays honoured rather than rejected --
  // she is holding a code this site emailed her -- but a session that never
  // got one cannot be conjured here either, so an unverifiable code is
  // refused exactly as it would have been.
  const verified = await verifyCode(input.email, code);
  if (!verified.ok) {
    return { status: "code_sent", email: input.email, message: verified.error };
  }

  const outcomes = await castVotes({
    nomineeIds: input.nomineeIds,
    categoryId: checked.category.id,
    input,
    deviceId: checked.deviceId,
    ipHash: checked.ipHash,
  });

  revalidatePath(`/vote/${slug}`);
  return { status: "done", outcomes };
}
