import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ApplicantWithCategory,
  ApplicantStatus,
  Category,
  FormType,
} from "@/lib/types";

/** Table rows are taller, so it pages at ten; the compact tiles fit a clean
 *  3x4 grid at twelve. */
export const PAGE_SIZE_TABLE = 10;
export const PAGE_SIZE_CARDS = 12;

const SELECT = "*, categories(id, name, slug)";

/** PostgREST `.or()` uses commas and parentheses as syntax, so a raw search
 *  string has to be neutered before it goes into the filter. */
function sanitizeSearch(value: string): string {
  return value.replace(/[,()%*\\]/g, " ").trim();
}

export type ApplicantQuery = {
  /** Which tab is open. Award and stall entries share the table, so every
   *  listing is scoped to one of them. */
  formType: FormType;
  search?: string;
  status?: ApplicantStatus;
  categoryId?: number;
  page?: number;
  pageSize?: number;
};

export async function listApplicants(params: ApplicantQuery) {
  const supabase = await createClient();
  const pageSize = params.pageSize ?? PAGE_SIZE_TABLE;
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("applicants")
    .select(SELECT, { count: "exact" })
    .eq("form_type", params.formType)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.status) query = query.eq("status", params.status);
  if (params.categoryId) query = query.eq("category_id", params.categoryId);

  const search = params.search ? sanitizeSearch(params.search) : "";
  if (search) {
    query = query.or(
      [
        `full_name.ilike.%${search}%`,
        `business_name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
        `whatsapp_number.ilike.%${search}%`,
        `area_location.ilike.%${search}%`,
      ].join(","),
    );
  }

  const { data, count, error } = await query;

  return {
    applicants: (data ?? []) as ApplicantWithCategory[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    error: error?.message ?? null,
  };
}

export async function getApplicant(id: string): Promise<ApplicantWithCategory | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("applicants").select(SELECT).eq("id", id).maybeSingle();
  return (data as ApplicantWithCategory | null) ?? null;
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, is_active")
    .order("sort_order", { ascending: true });
  return (data ?? []) as Category[];
}

/** Counts per status for the dashboard summary tiles. */
export async function applicantCounts(
  formType: FormType,
): Promise<Record<ApplicantStatus | "total", number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applicants")
    .select("status")
    .eq("form_type", formType);
  const rows = (data ?? []) as { status: ApplicantStatus }[];

  const counts = {
    total: rows.length,
    new: 0,
    payment_received: 0,
    promoted: 0,
    rejected: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/**
 * The logo bucket is private, so admins view images through a short-lived
 * signed URL rather than a public path.
 */
export async function signLogoUrl(path: string | null, expiresIn = 60 * 10) {
  if (!path) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from("applicant-logos")
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/**
 * Batch version for the list view -- one round trip for the whole page of
 * thumbnails instead of one signing call per row.
 */
export async function signLogoUrls(
  paths: (string | null)[],
  expiresIn = 60 * 10,
): Promise<Record<string, string>> {
  const present = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (present.length === 0) return {};

  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from("applicant-logos")
    .createSignedUrls(present, expiresIn);

  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}
