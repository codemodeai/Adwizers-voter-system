"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import type { SettingsFormState } from "./state";

function int(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

/**
 * Voting rules and security thresholds (Final Plan sections 5 and 8).
 *
 * These live in the database rather than in code because the moment they matter
 * most is mid-vote: if a live vote is being flooded, the limits need tightening
 * in seconds, not in a deploy.
 *
 * The bounds below are duplicated by a check constraint on the table. That is
 * deliberate -- this validation produces a readable message, and the constraint
 * makes it true even if something else ever writes the row.
 *
 * The emailed-code settings (`require_email_verification`,
 * `verify_session_minutes`) are no longer written either: the feature was
 * removed at the client's request.
 *
 * `max_selections_per_submit` is deliberately not written. It capped how many
 * nominees one category-page submission could include; every vote is now cast
 * from a single nominee's page, so the field is gone from the form and the
 * stored value is left exactly as it was rather than overwritten.
 */
export async function updateVotingRules(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { supabase, user } = await requireAdmin();

  const perIp = int(formData, "rate_limit_per_ip_per_minute");
  const perDevice = int(formData, "rate_limit_per_device_per_hour");

  if (!perIp || perIp < 1) return { status: "error", message: "Votes per IP must be at least 1." };
  if (!perDevice || perDevice < 1) {
    return { status: "error", message: "Votes per device must be at least 1." };
  }

  const { error } = await supabase
    .from("voting_settings")
    .update({
      rate_limit_per_ip_per_minute: perIp,
      rate_limit_per_device_per_hour: perDevice,
      updated_by: user.id,
    })
    .eq("id", 1);

  if (error) return { status: "error", message: `Could not save: ${error.message}` };

  revalidatePath("/admin/settings");
  return { status: "saved", message: "Voting rules saved." };
}
