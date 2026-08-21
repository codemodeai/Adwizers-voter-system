"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { setVotingWindow } from "@/app/admin/(dashboard)/voting/actions";
import { EMPTY_VOTING_FORM_STATE } from "@/app/admin/(dashboard)/voting/state";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

/**
 * An ISO instant as the value a `datetime-local` input wants: the same moment,
 * written in the browser's own zone, with the offset subtracted so the string
 * reads as wall-clock time.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** The reverse: a wall-clock string in the browser's zone, back to an instant. */
function toIso(local: string): string {
  if (!local) return "";
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="px-6">
      {pending ? "Saving…" : "Save window"}
    </Button>
  );
}

/**
 * The voting window (Final Plan section 10).
 *
 * The visible inputs are `datetime-local`, which carry no timezone at all; the
 * hidden fields alongside them hold the same moments as ISO instants computed
 * in the admin's own browser. Posting the bare local strings would force the
 * server to guess a zone, and guessing wrong moves a public deadline by hours.
 *
 * The admin's zone is named on screen for the same reason -- a deadline is the
 * last thing that should be ambiguous.
 */
export function VotingScheduleForm({
  startsAt,
  endsAt,
}: {
  startsAt: string | null;
  endsAt: string | null;
}) {
  const [state, action] = useActionState(setVotingWindow, EMPTY_VOTING_FORM_STATE);

  const [start, setStart] = useState(() => toLocalInput(startsAt));
  const [end, setEnd] = useState(() => toLocalInput(endsAt));

  const [zone, setZone] = useState<string | null>(null);
  // Reading the zone during render would differ between server and client and
  // trip hydration; an effect-free lazy read on first interaction is enough,
  // so this is set from the inputs themselves.
  function noteZone() {
    if (zone) return;
    try {
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setZone(null);
    }
  }

  const badOrder = Boolean(start && end && new Date(end) <= new Date(start));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="starts_at" value={toIso(start)} />
      <input type="hidden" name="ends_at" value={toIso(end)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-heading">Voting opens</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              noteZone();
            }}
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-heading">Voting closes</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
              noteZone();
            }}
            className={inputClass}
          />
          <span className="block text-[13px] text-ink-muted">
            Voting locks itself the moment this time passes — nothing to switch off.
          </span>
        </label>
      </div>

      {badOrder && (
        <p role="alert" className="text-[13px] font-medium text-magenta-dark">
          Voting must close after it opens.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Save />

        {(start || end) && (
          <button
            type="button"
            onClick={() => {
              setStart("");
              setEnd("");
            }}
            className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-muted hover:bg-canvas"
          >
            Clear both
          </button>
        )}

        {state.status !== "idle" && (
          <p
            role="status"
            className={`text-[13px] font-medium ${
              state.status === "saved" ? "text-gold-champagne" : "text-magenta-dark"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>

      <p className="text-[12px] text-ink-muted">
        Times are entered in this computer&rsquo;s timezone
        {zone ? ` (${zone})` : ""} and shown below in IST.
      </p>
    </form>
  );
}
