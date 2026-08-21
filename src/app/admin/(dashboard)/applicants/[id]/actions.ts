"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STALL_CATEGORIES } from "@/lib/carnival";
import type { ApplicantStatus } from "@/lib/types";
import { validateLogoFile } from "@/lib/validation/applicant";
import type { EditState, LogoState } from "./state";

const VALID_STATUSES: ApplicantStatus[] = ["new", "payment_received", "promoted", "rejected"];

const STALL_CATEGORY_SLUGS = STALL_CATEGORIES.map((c) => c.value);

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Admin edit of a Form 1 submission (Final Plan section 4: "Admin reviews and
 * can edit any field directly"). Deliberately permissive compared with the
 * public form -- this is a trusted operator fixing typos, not a stranger.
 * Only the fields the database requires are enforced here.
 */
export async function updateApplicant(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const { supabase } = await requireAdmin();
  const id = text(formData, "id");
  if (!id) return { status: "error", message: "Missing applicant id." };

  // Which form this entry came from decides which fields are even on screen,
  // so it has to come from the row rather than the posted payload.
  const { data: current } = await supabase
    .from("applicants")
    .select("form_type, status, payment_received_at")
    .eq("id", id)
    .maybeSingle();

  if (!current) return { status: "error", message: "Applicant not found." };
  const isStall = current.form_type === "stall";

  const fieldErrors: Record<string, string> = {};

  const fullName = text(formData, "full_name");
  const whatsapp = text(formData, "whatsapp_number");
  const email = text(formData, "email");
  const areaLocation = text(formData, "area_location");
  const businessName = text(formData, "business_name");
  const profession = text(formData, "profession");
  const categoryId = Number(text(formData, "category_id"));
  const stallCategory = text(formData, "stall_category");

  if (!fullName) fieldErrors.full_name = "Full name cannot be empty";
  if (!whatsapp) fieldErrors.whatsapp_number = "WhatsApp number cannot be empty";
  if (!areaLocation) fieldErrors.area_location = "Area / location cannot be empty";
  if (!businessName) fieldErrors.business_name = "Business name cannot be empty";

  if (isStall) {
    if (!STALL_CATEGORY_SLUGS.includes(stallCategory))
      fieldErrors.stall_category = "Choose a stall category";
  } else {
    if (!email) fieldErrors.email = "Email cannot be empty";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email";
    if (!profession) fieldErrors.profession = "Profession cannot be empty";
    if (!categoryId) fieldErrors.category_id = "Choose a category";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }

  const nextStatus = text(formData, "status") as ApplicantStatus;
  if (!VALID_STATUSES.includes(nextStatus)) {
    return { status: "error", message: "Unknown status." };
  }

  // Stamp the moment payment was marked received, and clear it if the status
  // is walked back, so the timestamp never contradicts the status.
  const wasPaid = current?.status === "payment_received" || current?.status === "promoted";
  const isPaid = nextStatus === "payment_received" || nextStatus === "promoted";

  let paymentReceivedAt = current?.payment_received_at ?? null;
  if (isPaid && !wasPaid) paymentReceivedAt = new Date().toISOString();
  if (!isPaid) paymentReceivedAt = null;

  // Everything both kinds of entry have in common.
  const shared = {
    full_name: fullName,
    whatsapp_number: whatsapp,
    area_location: areaLocation,
    business_name: businessName,
    years_in_business: nullableText(formData, "years_in_business"),
    social_instagram: normalizeUrl(nullableText(formData, "social_instagram")),
    social_facebook: normalizeUrl(nullableText(formData, "social_facebook")),
    social_website: normalizeUrl(nullableText(formData, "social_website")),
    social_whatsapp: normalizeUrl(nullableText(formData, "social_whatsapp")),
    wants_whatsapp_updates: formData.get("wants_whatsapp_updates") === "on",
    status: nextStatus,
    payment_received_at: paymentReceivedAt,
    admin_notes: nullableText(formData, "admin_notes"),
  };

  const specific = isStall
    ? {
        stall_category: stallCategory,
        business_about: nullableText(formData, "business_about"),
        stall_products: nullableText(formData, "stall_products"),
        stall_requirements: nullableText(formData, "stall_requirements"),
        stall_goals: formData
          .getAll("stall_goals")
          .filter((g): g is string => typeof g === "string"),
        // The stall form has no separate profession question; the brand name
        // stands for both, and it must not fall out of sync when edited.
        profession: businessName,
      }
    : {
        email: email.toLowerCase(),
        profession,
        category_id: categoryId,
        category_other: nullableText(formData, "category_other"),
        business_journey: nullableText(formData, "business_journey"),
        proudest_achievement: nullableText(formData, "proudest_achievement"),
        interested_in_nomination: text(formData, "interested_in_nomination") || "maybe",
      };

  const { error } = await supabase
    .from("applicants")
    .update({ ...shared, ...specific })
    .eq("id", id);

  if (error) {
    return { status: "error", message: `Could not save: ${error.message}` };
  }

  revalidatePath("/admin/applicants");
  revalidatePath(`/admin/applicants/${id}`);
  return { status: "saved", message: "Changes saved." };
}

/** Replaces or removes the applicant's photo in the private storage bucket. */
export async function updateLogo(_prev: LogoState, formData: FormData): Promise<LogoState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "replace");
  if (!id) return { status: "error", message: "Missing applicant id." };

  const { data: applicant } = await supabase
    .from("applicants")
    .select("logo_path")
    .eq("id", id)
    .maybeSingle();

  if (!applicant) return { status: "error", message: "Applicant not found." };

  const storage = createAdminClient().storage.from("applicant-logos");

  if (intent === "remove") {
    if (applicant.logo_path) await storage.remove([applicant.logo_path]);
    await supabase.from("applicants").update({ logo_path: null }).eq("id", id);
    revalidatePath(`/admin/applicants/${id}`);
    return { status: "saved", message: "Photo removed." };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image to upload." };
  }

  const invalid = validateLogoFile(file);
  if (invalid) return { status: "error", message: invalid };

  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] ?? "bin";
  const path = `${id}/logo.${ext}`;

  const { error: uploadError } = await storage.upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return { status: "error", message: uploadError.message };

  // A format change leaves the old object behind; clean it up.
  if (applicant.logo_path && applicant.logo_path !== path) {
    await storage.remove([applicant.logo_path]);
  }

  await supabase.from("applicants").update({ logo_path: path }).eq("id", id);
  revalidatePath(`/admin/applicants/${id}`);
  return { status: "saved", message: "Photo updated." };
}
