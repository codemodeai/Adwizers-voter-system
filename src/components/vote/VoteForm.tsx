"use client";

import Script from "next/script";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitVote } from "@/app/nominee/[code]/actions";
import { EMPTY_VOTE_STATE, type VoteOutcome, type VoteState } from "@/app/nominee/[code]/state";

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
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busy : label}
    </button>
  );
}

/**
 * The ballot on a nominee's personal page (Final Plan sections 6, 7, 8).
 *
 * One nominee, so there is nothing to choose: her profile is already on screen
 * above this, and the form is the voter's details and a submit. Nothing is
 * emailed or verified -- the vote is recorded on submit.
 *
 * The details live in state rather than only in the inputs: React resets a
 * form after its action runs, and a voter shown an error (a mistyped mobile
 * number, say) must not have to type everything again.
 */
export function VoteForm({
  nomineeCode,
  nomineeName,
  categoryName,
  turnstileSiteKey,
}: {
  /** Her number. The server resolves the nominee and her category from it, and
   *  trusts nothing else the page could send about either. */
  nomineeCode: string;
  nomineeName: string;
  categoryName: string;
  turnstileSiteKey: string | null;
}) {
  const [details, setDetails] = useState({ name: "", mobile: "", email: "", location: "" });
  const [state, action] = useActionState<VoteState, FormData>(submitVote, EMPTY_VOTE_STATE);

  const deviceIdRef = useDeviceIdInput();
  const formId = useId();

  if (state.status === "done") {
    return (
      <Receipt outcomes={state.outcomes} nomineeName={nomineeName} categoryName={categoryName} />
    );
  }

  return (
    <>
      {turnstileSiteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      )}

      <form id="vote" action={action} className="mx-auto mt-6 max-w-xl scroll-mt-6">
        <input type="hidden" name="nominee_code" value={nomineeCode} />
        <input ref={deviceIdRef} type="hidden" name="device_id" defaultValue="" />

        <div className="rounded-2xl border border-line bg-surface/70 p-5 sm:p-6">
          <h2 className="text-base font-bold text-heading">Vote for {nomineeName}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            Just your name and mobile number. Your mobile number keeps it to one vote per person, so
            please use your own.
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
              autoComplete="tel"
              placeholder="10-digit mobile number"
              hint="One vote per mobile number"
              value={details.mobile}
              onChange={(v) => setDetails((d) => ({ ...d, mobile: v }))}
            />
            <TextField
              id={`${formId}-email`}
              name="voter_email"
              label="Email"
              optional
              type="email"
              value={details.email}
              onChange={(v) => setDetails((d) => ({ ...d, email: v }))}
            />
            <TextField
              id={`${formId}-location`}
              name="voter_location"
              label="Location"
              optional
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

          {state.status === "error" && <Problem>{state.message}</Problem>}

          <div className="mt-5">
            <Submit label="Submit my vote" busy="Recording…" />
          </div>
        </div>

        <p className="mt-3 text-center text-[12px] text-ink-muted">
          One vote per person for each nominee.
        </p>
      </form>
    </>
  );
}

/**
 * The confirmation (section 6): her receipt when the vote is recorded, or a
 * plain note when this voter had already voted for her -- never a silent
 * nothing, which would look like a failure.
 */
function Receipt({
  outcomes,
  nomineeName,
  categoryName,
}: {
  outcomes: VoteOutcome[];
  nomineeName: string;
  categoryName: string;
}) {
  // One nominee per page, so one outcome. Read defensively all the same: an
  // empty list means the server found nobody to record a vote for.
  const outcome = outcomes[0];
  const status = outcome?.status ?? "failed";

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-gold/30 bg-gold/10 p-6 text-center">
      <p aria-hidden="true" className="text-3xl">
        {status === "recorded" ? "🎉" : status === "already" ? "👍" : "⚠️"}
      </p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-heading">
        {status === "recorded"
          ? `Your vote for ${nomineeName} is recorded`
          : status === "already"
            ? `You have already voted for ${nomineeName}`
            : "Your vote could not be recorded"}
      </h2>
      <p className="mt-1.5 text-[13px] text-ink-muted">{categoryName} · AWE Awards 2026</p>

      {status === "recorded" && outcome?.voteRef && (
        <p className="mt-4 text-[13px] text-ink-muted">
          Your reference{" "}
          <span className="ml-1 rounded-md bg-surface/70 px-2.5 py-1 font-mono text-[13px] font-semibold text-accent">
            {outcome.voteRef}
          </span>
        </p>
      )}

      {status === "already" && (
        <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
          Each person can vote for a nominee once. Thank you for supporting her!
        </p>
      )}

      {status === "failed" && (
        <p className="mt-4 text-[13px] font-medium text-accent">
          Please reload the page and try again.
        </p>
      )}

      {status !== "failed" && (
        <p className="mt-5 text-[13px] font-medium text-ink">
          Help her win — share this page with your friends and family.
        </p>
      )}
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
  optional = false,
  type = "text",
  inputMode,
  hint,
  placeholder,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Shows "(optional)" beside the label, so a voter can see at a glance
   *  which fields she may skip. */
  optional?: boolean;
  type?: string;
  inputMode?: "tel" | "numeric" | "email";
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
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
        {optional && (
          <span className="ml-1.5 text-[12px] font-normal text-ink-muted">(optional)</span>
        )}
      </span>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
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
