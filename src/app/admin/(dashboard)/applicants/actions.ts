"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { notifyNominee } from "@/lib/email/notify";

export type PaymentResult = { ok: boolean; error?: string };

/**
 * Promotion reports the email separately from the promotion itself. The
 * nominee being live and the applicant having been told are two different
 * facts, and collapsing them into one boolean would either hide a failed send
 * or make a successful promotion look broken.
 */
export type PromoteResult = PaymentResult & { notice?: string };

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
 * Promote to Nominee (Final Plan section 4), in the order the plan gives:
 * create the linked nominee profile, publish it on the category page, mark the
 * applicant promoted, then notify her.
 *
 * Order matters twice over. The plan's workflow is submit -> payment received
 * -> promote, so this refuses anything unpaid. And within the action, the
 * nominee row is written *before* the applicant's status changes: if the insert
 * fails, the applicant is left exactly as she was rather than marked promoted
 * with nothing to show for it.
 *
 * The email is deliberately last and deliberately non-fatal. A Resend outage or
 * an unverified sending domain must not undo a promotion that already
 * succeeded -- the failure is recorded on the nominee instead, and the Nominees
 * screen offers a resend.
 */
export async function promoteToNominee(id: string): Promise<PromoteResult> {
  const { supabase } = await requireAdmin();

  const { data: applicant } = await supabase
    .from("applicants")
    .select(
      `id, form_type, status, full_name, business_name, email, area_location,
       business_journey, proudest_achievement, logo_path, category_id,
       social_instagram, social_facebook, social_website, social_whatsapp,
       categories(id, name, slug)`,
    )
    .eq("id", id)
    .maybeSingle<PromotableApplicant>();

  if (!applicant) return { ok: false, error: "Applicant not found." };

  // Nominees come out of the awards. A carnival stall booking has nowhere to be
  // promoted to -- the button is hidden for those, so this is the guard for a
  // server action called directly.
  if (applicant.form_type !== "award") {
    return { ok: false, error: "Only award entries can become nominees." };
  }

  if (applicant.status !== "payment_received" && applicant.status !== "promoted") {
    return { ok: false, error: "Mark payment received first." };
  }

  if (!applicant.category_id || !applicant.categories) {
    return { ok: false, error: "This entry has no award category. Set one first." };
  }

  // Already has a profile: promotion is done. Re-clicking should not create a
  // second nominee or send the email twice.
  const { data: existing } = await supabase
    .from("nominees")
    .select("id")
    .eq("applicant_id", id)
    .maybeSingle();

  if (existing) {
    if (applicant.status !== "promoted") {
      await supabase.from("applicants").update({ status: "promoted" }).eq("id", id);
      revalidatePath("/admin/applicants");
      revalidatePath(`/admin/applicants/${id}`);
    }
    return { ok: true, notice: "Already a nominee." };
  }

  const { data: nominee, error: insertError } = await supabase
    .from("nominees")
    .insert({
      applicant_id: applicant.id,
      category_id: applicant.category_id,
      display_name: applicant.full_name,
      business_name: applicant.business_name,
      area_location: applicant.area_location,
      // The public card wants a short bio. Her journey answer is the closest
      // thing Form 1 collects; the admin edits it into shape afterwards.
      bio: applicant.business_journey || applicant.proudest_achievement,
      photo_path: applicant.logo_path,
      social_instagram: applicant.social_instagram,
      social_facebook: applicant.social_facebook,
      social_website: applicant.social_website,
      social_whatsapp: applicant.social_whatsapp,
      is_published: true,
    })
    .select("id")
    .single();

  if (insertError || !nominee) {
    return { ok: false, error: insertError?.message ?? "Could not create the nominee profile." };
  }

  const { error: statusError } = await supabase
    .from("applicants")
    .update({ status: "promoted" })
    .eq("id", id);

  if (statusError) {
    // Undo the profile we just created rather than leave a published nominee
    // whose applicant still reads "Payment Received".
    await supabase.from("nominees").delete().eq("id", nominee.id);
    return { ok: false, error: statusError.message };
  }

  const notice = await notifyNominee(supabase, {
    nomineeId: nominee.id,
    email: applicant.email,
    name: applicant.full_name,
    businessName: applicant.business_name,
    categoryName: applicant.categories.name,
    categorySlug: applicant.categories.slug,
  });

  revalidatePath("/admin/applicants");
  revalidatePath(`/admin/applicants/${id}`);
  revalidatePath("/admin/nominees");
  revalidatePath("/admin/categories");
  revalidatePath(`/vote/${applicant.categories.slug}`);

  return { ok: true, notice };
}

type PromotableApplicant = {
  id: string;
  form_type: "award" | "stall";
  status: string;
  full_name: string;
  business_name: string;
  email: string | null;
  area_location: string | null;
  business_journey: string | null;
  proudest_achievement: string | null;
  logo_path: string | null;
  category_id: number | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_website: string | null;
  social_whatsapp: string | null;
  categories: { id: number; name: string; slug: string } | null;
};
