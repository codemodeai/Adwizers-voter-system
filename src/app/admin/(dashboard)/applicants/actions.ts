"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";

export type PaymentResult = { ok: boolean; error?: string };

/**
 * Flips an applicant between "New" and "Payment Received" from the list or the
 * review header, without opening the full edit form.
 *
 * Payment is collected offline (Final Plan section 4), so this is the single
 * most repeated admin action -- worth having in reach everywhere.
 */
export async function setPaymentReceived(
  id: string,
  paid: boolean,
): Promise<PaymentResult> {
  const { supabase } = await requireAdmin();

  const { data: current } = await supabase
    .from("applicants")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!current) return { ok: false, error: "Applicant not found." };

  // A promoted nominee has already been paid for and published; unwinding that
  // from a list toggle would silently contradict the nominee record.
  if (current.status === "promoted") {
    return { ok: false, error: "Already promoted to nominee." };
  }

  const { error } = await supabase
    .from("applicants")
    .update({
      status: paid ? "payment_received" : "new",
      payment_received_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/applicants");
  revalidatePath(`/admin/applicants/${id}`);
  return { ok: true };
}

/**
 * Marks an applicant as promoted to nominee.
 *
 * Order matters: the plan's workflow is submit -> payment received -> promote,
 * so this refuses anything that has not been paid for yet.
 *
 * PHASE 2 SCOPE: this currently only moves the applicant's status. Creating the
 * linked nominee profile and firing the Resend notification (Final Plan
 * sections 3 and 4) arrives with the Nominees module -- at which point this
 * action grows those two steps and should gain a confirmation prompt, since it
 * will then send real email.
 */
export async function promoteToNominee(id: string): Promise<PaymentResult> {
  const { supabase } = await requireAdmin();

  const { data: current } = await supabase
    .from("applicants")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!current) return { ok: false, error: "Applicant not found." };
  if (current.status === "promoted") return { ok: true };

  if (current.status !== "payment_received") {
    return { ok: false, error: "Mark payment received first." };
  }

  const { error } = await supabase
    .from("applicants")
    .update({ status: "promoted" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/applicants");
  revalidatePath(`/admin/applicants/${id}`);
  return { ok: true };
}
