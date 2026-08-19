"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  applicantFormSchema,
  validateLogoFile,
  type ApplicantFormParsed,
} from "@/lib/validation/applicant";
import type { RegisterState } from "./state";

/** Text fields we re-populate on a failed submit. */
const ECHOED_FIELDS = [
  "fullName",
  "whatsappNumber",
  "email",
  "areaLocation",
  "businessName",
  "profession",
  "categoryId",
  "categoryOther",
  "yearsInBusiness",
  "businessJourney",
  "proudestAchievement",
  "socialInstagram",
  "socialFacebook",
  "socialWebsite",
  "socialWhatsapp",
  "interestedInNomination",
  "wantsWhatsappUpdates",
  "nominationDeclaration",
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

export async function submitApplication(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const values = echoValues(formData);
  const supabase = createAdminClient();

  // The slug drives the "Other -- please specify" rule, and it has to come from
  // the database rather than the submitted form so it cannot be spoofed.
  const categoryIdRaw = formData.get("categoryId");
  let categorySlug: string | undefined;

  if (typeof categoryIdRaw === "string" && categoryIdRaw !== "") {
    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", Number(categoryIdRaw))
      .eq("is_active", true)
      .maybeSingle();

    if (!category) {
      return {
        status: "error",
        values,
        fieldErrors: { categoryId: "Please choose a business category" },
      };
    }
    categorySlug = category.slug;
  }

  const parsed = applicantFormSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    whatsappNumber: formData.get("whatsappNumber") ?? "",
    email: formData.get("email") ?? "",
    areaLocation: formData.get("areaLocation") ?? "",
    businessName: formData.get("businessName") ?? "",
    profession: formData.get("profession") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    categoryOther: formData.get("categoryOther") ?? "",
    yearsInBusiness: formData.get("yearsInBusiness") ?? "",
    businessJourney: formData.get("businessJourney") ?? "",
    proudestAchievement: formData.get("proudestAchievement") ?? "",
    socialInstagram: formData.get("socialInstagram") ?? "",
    socialFacebook: formData.get("socialFacebook") ?? "",
    socialWebsite: formData.get("socialWebsite") ?? "",
    socialWhatsapp: formData.get("socialWhatsapp") ?? "",
    interestedInNomination: formData.get("interestedInNomination") ?? "",
    wantsWhatsappUpdates: formData.get("wantsWhatsappUpdates") === "on",
    nominationDeclaration: formData.get("nominationDeclaration") === "on",
    termsAccepted: formData.get("termsAccepted") === "on",
    communicationConsent: formData.get("communicationConsent") === "on",
    categorySlug,
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
      fieldErrors,
      formError: "Please fix the highlighted fields and submit again.",
    };
  }

  const data: ApplicantFormParsed = parsed.data;
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
        formError: "We could not upload your image. Please try again.",
        fieldErrors: { logo: uploadError.message },
      };
    }
    logoPath = path;
  }

  const { error: insertError } = await supabase.from("applicants").insert({
    id: applicantId,
    full_name: data.fullName,
    whatsapp_number: data.whatsappNumber,
    email: data.email.toLowerCase(),
    area_location: data.areaLocation,
    business_name: data.businessName,
    profession: data.profession,
    category_id: data.categoryId,
    category_other: categorySlug === "other" ? (data.categoryOther ?? null) : null,
    years_in_business: data.yearsInBusiness ?? null,
    business_journey: data.businessJourney ?? null,
    proudest_achievement: data.proudestAchievement ?? null,
    social_instagram: data.socialInstagram ?? null,
    social_facebook: data.socialFacebook ?? null,
    social_website: data.socialWebsite ?? null,
    social_whatsapp: data.socialWhatsapp ?? null,
    logo_path: logoPath,
    interested_in_nomination: data.interestedInNomination,
    wants_whatsapp_updates: data.wantsWhatsappUpdates,
    nomination_declaration_at: now,
    terms_accepted_at: now,
    communication_consent_at: data.communicationConsent ? now : null,
  });

  if (insertError) {
    if (logoPath) {
      await supabase.storage.from("applicant-logos").remove([logoPath]);
    }
    return {
      status: "error",
      values,
      formError:
        "Something went wrong saving your application. Please try again in a moment.",
    };
  }

  redirect("/register/thank-you");
}
