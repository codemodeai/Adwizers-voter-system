"use server";

import { redirect } from "next/navigation";

import { STALL_FEE_INR } from "@/lib/carnival";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateLogoFile } from "@/lib/validation/applicant";
import { stallFormSchema, type StallFormParsed } from "@/lib/validation/stall";
import type { CarnivalState } from "./state";

/** Text fields we re-populate on a failed submit. */
const ECHOED_FIELDS = [
  "fullName",
  "whatsappNumber",
  "areaLocation",
  "businessName",
  "businessAbout",
  "stallCategory",
  "yearsInBusiness",
  "stallProducts",
  "stallRequirements",
  "socialInstagram",
  "socialFacebook",
  "socialWebsite",
  "socialWhatsapp",
  "feeAgreed",
  "termsAccepted",
  "communicationConsent",
] as const;

function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of ECHOED_FIELDS) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

function extension(file: File): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[file.type] ?? "bin";
}

export async function submitStallBooking(
  _prev: CarnivalState,
  formData: FormData,
): Promise<CarnivalState> {
  const values = echoValues(formData);
  const goals = formData.getAll("stallGoals").filter((g): g is string => typeof g === "string");
  const supabase = createAdminClient();

  const parsed = stallFormSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    whatsappNumber: formData.get("whatsappNumber") ?? "",
    areaLocation: formData.get("areaLocation") ?? "",
    businessName: formData.get("businessName") ?? "",
    businessAbout: formData.get("businessAbout") ?? "",
    stallCategory: formData.get("stallCategory") ?? "",
    yearsInBusiness: formData.get("yearsInBusiness") ?? "",
    stallProducts: formData.get("stallProducts") ?? "",
    stallRequirements: formData.get("stallRequirements") ?? "",
    stallGoals: goals,
    socialInstagram: formData.get("socialInstagram") ?? "",
    socialFacebook: formData.get("socialFacebook") ?? "",
    socialWebsite: formData.get("socialWebsite") ?? "",
    socialWhatsapp: formData.get("socialWhatsapp") ?? "",
    feeAgreed: formData.get("feeAgreed") === "on",
    termsAccepted: formData.get("termsAccepted") === "on",
    communicationConsent: formData.get("communicationConsent") === "on",
  });

  const logo = formData.get("logo");
  const logoFile = logo instanceof File && logo.size > 0 ? logo : null;
  const logoError = validateLogoFile(logoFile);

  if (!parsed.success || logoError) {
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
    }
    if (logoError) fieldErrors.logo = logoError;

    return {
      status: "error",
      values,
      goals,
      fieldErrors,
      formError: "Please fix the highlighted fields and submit again.",
    };
  }

  const data: StallFormParsed = parsed.data;
  const applicantId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Upload first so a storage failure never leaves a half-written row.
  let logoPath: string | null = null;
  if (logoFile) {
    const path = `${applicantId}/logo.${extension(logoFile)}`;
    const { error: uploadError } = await supabase.storage
      .from("applicant-logos")
      .upload(path, logoFile, { contentType: logoFile.type, upsert: true });

    if (uploadError) {
      return {
        status: "error",
        values,
        goals,
        formError: "We could not upload your image. Please try again.",
        fieldErrors: { logo: uploadError.message },
      };
    }
    logoPath = path;
  }

  const { error: insertError } = await supabase.from("applicants").insert({
    id: applicantId,
    form_type: "stall",
    full_name: data.fullName,
    whatsapp_number: data.whatsappNumber,
    area_location: data.areaLocation,
    business_name: data.businessName,
    // The stall form has no separate "profession" question -- what she sells is
    // the business itself, so the brand name stands for both.
    profession: data.businessName,
    stall_category: data.stallCategory,
    business_about: data.businessAbout ?? null,
    years_in_business: data.yearsInBusiness ?? null,
    stall_products: data.stallProducts ?? null,
    stall_requirements: data.stallRequirements ?? null,
    stall_goals: data.stallGoals,
    social_instagram: data.socialInstagram ?? null,
    social_facebook: data.socialFacebook ?? null,
    social_website: data.socialWebsite ?? null,
    social_whatsapp: data.socialWhatsapp ?? null,
    logo_path: logoPath,
    wants_whatsapp_updates: false,
    terms_accepted_at: now,
    communication_consent_at: data.communicationConsent ? now : null,
    fee_agreed_at: now,
    fee_amount_inr: STALL_FEE_INR,
  });

  if (insertError) {
    if (logoPath) {
      await supabase.storage.from("applicant-logos").remove([logoPath]);
    }
    return {
      status: "error",
      values,
      goals,
      formError:
        "Something went wrong saving your booking. Please try again in a moment.",
    };
  }

  redirect("/carnival/thank-you");
}
