import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { nomineeSelectedEmail } from "@/lib/email/nomineeSelected";
import { sendEmail } from "@/lib/email/resend";
import { absoluteCategoryVoteUrl } from "@/lib/nominees";

export type NotifyParams = {
  nomineeId: string;
  email: string | null;
  name: string;
  businessName: string;
  categoryName: string;
  categorySlug: string;
};

/**
 * Sends the nominee selection email and writes the outcome onto the nominee
 * row, returning the one line the admin should see about it (or undefined when
 * it simply worked).
 *
 * Lives here rather than beside the server action because it takes a Supabase
 * client: everything exported from a `"use server"` module is an addressable
 * endpoint whose arguments must be serialisable, which a client is not.
 *
 * Shared by the automatic send on promotion and the manual resend on the
 * nominee screen, so a retry leaves exactly the same trail as the original.
 * Never throws -- the caller has already changed real data by the time this
 * runs, and an email failure must not unwind it.
 */
export async function notifyNominee(
  supabase: SupabaseClient,
  params: NotifyParams,
): Promise<string | undefined> {
  if (!params.email) {
    await supabase
      .from("nominees")
      .update({ notify_error: "No email address on the original entry." })
      .eq("id", params.nomineeId);
    return "No email address on this entry, so nothing was sent.";
  }

  const result = await sendEmail(
    nomineeSelectedEmail({
      to: params.email,
      name: params.name,
      businessName: params.businessName,
      categoryName: params.categoryName,
      voteUrl: absoluteCategoryVoteUrl(params.categorySlug),
    }),
  );

  if (result.status === "sent") {
    await supabase
      .from("nominees")
      .update({
        notified_at: new Date().toISOString(),
        notify_email: params.email,
        notify_error: null,
      })
      .eq("id", params.nomineeId);
    return undefined;
  }

  const reason = result.status === "skipped" ? result.reason : result.error;

  await supabase
    .from("nominees")
    .update({ notify_email: params.email, notify_error: reason })
    .eq("id", params.nomineeId);

  return result.status === "skipped"
    ? "Email is not configured yet, so none was sent — you can send it from Nominees once it is."
    : `The email failed: ${reason}`;
}
