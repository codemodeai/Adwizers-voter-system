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
      <p className="rounded-xl border border-line bg-purple-soft/40 px-4 py-3.5 text-[13px] leading-relaxed text-charcoal">
        <strong className="font-semibold text-purple-royal">How duplicates are stopped.</strong>{" "}
        One vote per nominee per mobile number and per email address. Nothing is sent to the voter
        and nothing is verified — the vote is recorded the moment she submits. Several people
        sharing one phone can each vote. The limits below only control how fast votes can come in.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Votes per minute, per IP address"
          htmlFor="rate_limit_per_ip_per_minute"
          hint="Each vote is one nominee. Blunts scripted bursts — too low and a family on one wifi connection, or many phones on one mobile network, block each other. Plan default: 3."
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
          hint="Not a one-vote rule — a shared phone can vote for the same nominee once per person. This only caps how fast one device can submit. Plan default: 20."
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
