"use client";

import Script from "next/script";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { startVote, submitWithCode } from "@/app/vote/[slug]/actions";
import { EMPTY_VOTE_STATE, type VoteState } from "@/app/vote/[slug]/state";
import { NomineeCard } from "@/components/vote/NomineeCard";
import type { PublicNominee } from "@/lib/nominees";

const DEVICE_KEY = "awe_device_id";

/**
 * The device id (Final Plan section 8): minted on first visit, kept in
 * localStorage *and* a cookie so clearing one alone does not hand someone a
 * clean slate. The server treats it as self-declared, exactly as the plan says.
 *
 * Written straight into the hidden input rather than into React state. It is
 * read once from browser storage and never rendered, so putting it in state
 * would trigger a second render on every page load to produce markup identical
 * except for one hidden value -- and reading storage during render would
 * mismatch hydration, since the server cannot know it.
 */
function useDeviceIdInput() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let value = "";
    try {
      value = window.localStorage.getItem(DEVICE_KEY) ?? "";
    } catch {
      // Private browsing, or storage disabled. The cookie still carries one.
    }

    if (!value) {
      const cookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("awe_did="))
        ?.split("=")[1];
      value = cookie || crypto.randomUUID();
    }

    try {
      window.localStorage.setItem(DEVICE_KEY, value);
    } catch {
      // Nothing to do; the server sets its own cookie regardless.
    }

    if (ref.current) ref.current.value = value;
  }, []);

  return ref;
}

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-accent px-6 py-3.5 text-base font-semibold text-white
                 shadow-lg shadow-accent/25 transition-colors hover:bg-accent-hover
                 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
    >
      {pending ? busy : label}
    </button>
  );
}

/**
 * The ballot (Final Plan sections 6, 7, 8).
 *
 * One page, one submission: the voter ticks everyone she wants to back in this
 * category, fills her details once, and submits. That is section 6's whole
 * shape, and it is why the selection lives here rather than on each card.
 *
 * The selection is held in this component across the verification step, so
 * entering a code never costs the voter her choices.
 */
export function VoteForm({
  slug,
  categoryName,
  nominees,
  photoUrls,
  turnstileSiteKey,
}: {
  slug: string;
  categoryName: string;
  nominees: PublicNominee[];
  photoUrls: Record<string, string>;
  turnstileSiteKey: string | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, action] = useActionState<VoteState, FormData>(startVote, EMPTY_VOTE_STATE);
  const [codeState, codeAction] = useActionState<VoteState, FormData>(
    submitWithCode,
    EMPTY_VOTE_STATE,
  );
  const deviceIdRef = useDeviceIdInput();
  const formId = useId();

  // Once the code step opens, that flow owns the screen.
  const active: VoteState = codeState.status !== "idle" ? codeState : state;
  const awaitingCode = active.status === "code_sent";

  const [details, setDetails] = useState({ name: "", mobile: "", email: "", location: "" });

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  }

  if (active.status === "done") {
    return <Receipt outcomes={active.outcomes} categoryName={categoryName} />;
  }

  return (
    <>
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
        />
      )}

      <form action={awaitingCode ? codeAction : action} className="mt-8">
        <input type="hidden" name="slug" value={slug} />
        <input ref={deviceIdRef} type="hidden" name="device_id" defaultValue="" />
        {/* Carried through the code step so a verification never loses the
          * voter's selection or her typed details. */}
        {selected.map((id) => (
          <input key={id} type="hidden" name="nominee" value={id} />
        ))}
        {awaitingCode && (
          <>
            <input type="hidden" name="voter_name" value={details.name} />
            <input type="hidden" name="voter_mobile" value={details.mobile} />
            <input type="hidden" name="voter_email" value={details.email} />
            <input type="hidden" name="voter_location" value={details.location} />
          </>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nominees.map((nominee) => (
            <NomineeCard
              key={nominee.id}
              nominee={nominee}
              photoUrl={nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null}
              selectable={!awaitingCode}
              selected={selected.includes(nominee.id)}
              onToggle={() => toggle(nominee.id)}
            />
          ))}
        </ul>

        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-line bg-surface/70 p-5 sm:p-6">
          {awaitingCode ? (
            <CodeStep email={active.email} message={active.message} />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold text-heading">Your details</h2>
                <p className="text-[13px] font-medium text-accent">
                  {selected.length === 0
                    ? "No nominees selected yet"
                    : `${selected.length} selected`}
                </p>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                Filled once, however many nominees you pick. We email you a code to confirm it&rsquo;s
                you — one code covers your whole visit.
              </p>

              <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                <TextField
                  id={`${formId}-name`}
                  name="voter_name"
                  label="Your name"
                  required
                  value={details.name}
                  onChange={(v) => setDetails((d) => ({ ...d, name: v }))}
                />
                <TextField
                  id={`${formId}-mobile`}
                  name="voter_mobile"
                  label="Mobile number"
                  required
                  inputMode="tel"
                  value={details.mobile}
                  onChange={(v) => setDetails((d) => ({ ...d, mobile: v }))}
                />
                <TextField
                  id={`${formId}-email`}
                  name="voter_email"
                  label="Email"
                  required
                  type="email"
                  hint="Your code comes here"
                  value={details.email}
                  onChange={(v) => setDetails((d) => ({ ...d, email: v }))}
                />
                <TextField
                  id={`${formId}-location`}
                  name="voter_location"
                  label="Location"
                  value={details.location}
                  onChange={(v) => setDetails((d) => ({ ...d, location: v }))}
                />
              </div>

              {turnstileSiteKey && (
                <div
                  className="cf-turnstile mt-4"
                  data-sitekey={turnstileSiteKey}
                  data-theme="dark"
                  data-size="flexible"
                />
              )}

              {active.status === "error" && <Problem>{active.message}</Problem>}

              <div className="mt-5">
                <Submit label="Continue" busy="Checking…" />
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                One vote per nominee. You can back several nominees in this category, and vote in
                other categories too.
              </p>
            </>
          )}
        </div>
      </form>
    </>
  );
}

function CodeStep({ email, message }: { email: string; message?: string }) {
  return (
    <>
      <h2 className="text-base font-bold text-heading">Check your email</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
        We sent a 6-digit code to <strong className="text-ink">{email}</strong>. Enter it to record
        your votes. It also unlocks any other category for the rest of your visit.
      </p>

      <label className="mt-4 block">
        <span className="block text-sm font-medium text-heading">Your code</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          placeholder="000000"
          className="mt-1.5 w-full rounded-lg border border-line bg-raised px-3.5 py-3
                     text-center font-mono text-2xl tracking-[0.4em] text-ink
                     placeholder:text-ink-muted/40 focus:border-accent focus:outline-none
                     focus:ring-2 focus:ring-accent/25"
        />
      </label>

      {message && <Problem>{message}</Problem>}

      <div className="mt-5">
        <Submit label="Confirm my votes" busy="Recording…" />
      </div>

      <p className="mt-3 text-[12px] text-ink-muted">
        No email? Check spam. The code expires with your session.
      </p>
    </>
  );
}

/**
 * The confirmation (section 6): a receipt per nominee recorded, and a plain
 * note for any that were already voted for. Both are shown, because a batch is
 * not all-or-nothing and hiding the skipped ones would look like a silent
 * failure.
 */
function Receipt({
  outcomes,
  categoryName,
}: {
  outcomes: { nomineeId: string; name: string; status: string; voteRef?: string }[];
  categoryName: string;
}) {
  const recorded = outcomes.filter((o) => o.status === "recorded");
  const already = outcomes.filter((o) => o.status === "already");
  const failed = outcomes.filter((o) => o.status === "failed");

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-gold/30 bg-gold/10 p-6 text-center">
      <p aria-hidden="true" className="text-3xl">
        {recorded.length > 0 ? "🎉" : "👍"}
      </p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-heading">
        {recorded.length > 0
          ? `${recorded.length} vote${recorded.length === 1 ? "" : "s"} recorded`
          : "Nothing new to record"}
        {already.length > 0 && `, ${already.length} already voted for`}
      </h2>
      <p className="mt-1.5 text-[13px] text-ink-muted">in {categoryName}</p>

      {recorded.length > 0 && (
        <ul className="mt-5 space-y-2 text-left">
          {recorded.map((outcome) => (
            <li
              key={outcome.nomineeId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl
                         bg-surface/70 px-3.5 py-2.5"
            >
              <span className="text-[14px] font-semibold text-heading">{outcome.name}</span>
              {outcome.voteRef && (
                <span className="font-mono text-[12px] font-semibold text-accent">
                  {outcome.voteRef}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {already.length > 0 && (
        <p className="mt-4 text-left text-[13px] leading-relaxed text-ink-muted">
          You had already voted for{" "}
          <strong className="text-ink">{already.map((o) => o.name).join(", ")}</strong>. Each
          nominee can only be voted for once.
        </p>
      )}

      {failed.length > 0 && (
        <p className="mt-3 text-left text-[13px] font-medium text-accent">
          Could not record a vote for {failed.map((o) => o.name).join(", ")}. Please try again.
        </p>
      )}

      <p className="mt-5 text-[12px] text-ink-muted">
        Keep these reference codes. Voting in another category needs no new code this visit.
      </p>
    </div>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-3.5 py-2.5
                 text-[13px] font-medium text-accent"
    >
      {children}
    </p>
  );
}

function TextField({
  id,
  name,
  label,
  value,
  onChange,
  required = false,
  type = "text",
  inputMode,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  inputMode?: "tel" | "numeric" | "email";
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-sm font-medium text-heading">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-accent">
            *
          </span>
        )}
      </span>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // 16px base: iOS Safari zooms the page on any focused input below it.
        className="mt-1.5 w-full rounded-lg border border-line bg-raised px-3.5 py-2.5
                   text-base text-ink placeholder:text-ink-muted/55 focus:border-accent
                   focus:outline-none focus:ring-2 focus:ring-accent/25 sm:text-[15px]"
      />
      {hint && <span className="mt-1 block text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}
