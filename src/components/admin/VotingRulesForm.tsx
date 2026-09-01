"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateVotingRules } from "@/app/admin/(dashboard)/settings/actions";
import { EMPTY_SETTINGS_FORM_STATE } from "@/app/admin/(dashboard)/settings/state";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import type { VotingRules } from "@/lib/voting";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="px-6">
      {pending ? "Saving…" : "Save rules"}
    </Button>
  );
}

/**
 * Voting rules and security thresholds (Final Plan sections 5 and 8).
 *
 * Every field says what it costs to get wrong, because these are the settings
 * whose defaults came from the plan for a reason: too tight blocks a family
 * sharing one wifi connection, too loose stops blunting a scripted burst.
 */
export function VotingRulesForm({ rules }: { rules: VotingRules }) {
  const [state, action] = useActionState(updateVotingRules, EMPTY_SETTINGS_FORM_STATE);

  return (
    <form action={action} className="space-y-5">
      {/* First, because it decides whether the field under it means anything
        * -- and because it is the one setting here that changes what a voter
        * is asked to do, rather than how much of it she may do. */}
      <label className="flex gap-3 rounded-xl border border-line bg-purple-soft/40 px-4 py-3.5">
        <input
          type="checkbox"
          name="require_email_verification"
          defaultChecked={rules.require_email_verification}
          className="mt-0.5 size-4 shrink-0 accent-magenta-royal"
        />
        <span className="text-[13px] leading-relaxed text-charcoal">
          <strong className="font-semibold text-purple-royal">
            Email a 6-digit code before recording a vote
          </strong>
          <br />
          Off while Amazon SES is still in its sandbox — with it off, votes are recorded the moment
          the voter submits. Duplicates are still blocked either way: one vote per nominee per
          mobile number, per email address and per device, on top of the rate limits below. What a
          code adds is proof the email address is really hers, so leaving this off means a
          determined voter can invent a new address per vote.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Votes per minute, per IP address"
          htmlFor="rate_limit_per_ip_per_minute"
          hint="Blunts scripted bursts. Too low and a family on one wifi connection blocks each other. Plan default: 3."
        >
          <input
            id="rate_limit_per_ip_per_minute"
            name="rate_limit_per_ip_per_minute"
            type="number"
            min={1}
            defaultValue={rules.rate_limit_per_ip_per_minute}
            className={inputClass}
          />
        </Field>

        <Field
          label="Votes per hour, per device"
          htmlFor="rate_limit_per_device_per_hour"
          hint="Covers one real voter moving across several categories, while still stopping flooding. Plan default: 20."
        >
          <input
            id="rate_limit_per_device_per_hour"
            name="rate_limit_per_device_per_hour"
            type="number"
            min={1}
            defaultValue={rules.rate_limit_per_device_per_hour}
            className={inputClass}
          />
        </Field>

        <Field
          label="Email verification lasts (minutes)"
          htmlFor="verify_session_minutes"
          hint="Only used while the code above is switched on: how long one code unlocks voting for. Verification is once per visit, not once per vote. Plan default: 30–60."
        >
          <input
            id="verify_session_minutes"
            name="verify_session_minutes"
            type="number"
            min={5}
            max={240}
            defaultValue={rules.verify_session_minutes}
            className={inputClass}
          />
        </Field>

        <Field
          label="Maximum nominees per submission"
          htmlFor="max_selections_per_submit"
          hint="Leave empty for no limit — the plan allows voting for every nominee in a category at once."
        >
          <input
            id="max_selections_per_submit"
            name="max_selections_per_submit"
            type="number"
            min={1}
            placeholder="No limit"
            defaultValue={rules.max_selections_per_submit ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Save />
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
    </form>
  );
}
