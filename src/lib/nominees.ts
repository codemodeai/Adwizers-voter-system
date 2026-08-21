import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { formUrl } from "@/lib/target";
import type { Category, NomineeWithCategory } from "@/lib/types";

const SELECT = "*, categories(id, name, slug)";

/**
 * The shareable link for a category (Final Plan sections 5 and 6): one link per
 * category, never one per nominee. Absolute on the form domain when it is
 * configured, so the value in the dashboard is copy-pasteable into WhatsApp.
 */
export function categoryVoteUrl(slug: string): string {
  return formUrl(`/vote/${slug}`);
}

/** Absolute vote URL, or null when no public origin is configured -- which is
 *  local development, where a relative path in an email would be useless. */
export function absoluteCategoryVoteUrl(slug: string): string | null {
  const url = categoryVoteUrl(slug);
  return url.startsWith("http") ? url : null;
}

export type NomineeQuery = {
  search?: string;
  categoryId?: number;
  published?: boolean;
};

/**
 * Admin listing. Not paginated: 14 categories at a handful of nominees each is
 * a list an admin wants to see whole, and the Categories screen groups the same
 * rows without a second round trip.
 */
export async function listNominees(params: NomineeQuery = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("nominees")
    .select(SELECT, { count: "exact" })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  if (params.published !== undefined) query = query.eq("is_published", params.published);

  const search = params.search?.replace(/[,()%*\\]/g, " ").trim();
  if (search) {
    query = query.or(
      [`display_name.ilike.%${search}%`, `business_name.ilike.%${search}%`].join(","),
    );
  }

  const { data, count, error } = await query;

  return {
    nominees: (data ?? []) as NomineeWithCategory[],
    total: count ?? 0,
    error: error?.message ?? null,
  };
}

export async function getNominee(id: string): Promise<NomineeWithCategory | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("nominees").select(SELECT).eq("id", id).maybeSingle();
  return (data as NomineeWithCategory | null) ?? null;
}

export type CategoryWithNominees = Category & {
  /** Per-category voting pause. Defaulted rather than required, so this keeps
   *  working against a database where the column has not been added yet. */
  voting_paused: boolean;
  nominees: NomineeWithCategory[];
  publishedCount: number;
};

/**
 * Every category with its nominees attached -- the shape the Categories screen
 * renders, and the reason that screen can show counts without a query per row.
 * Categories with no nominees are kept: an empty category still has a link to
 * share and an order to set.
 */
export async function listCategoriesWithNominees(): Promise<CategoryWithNominees[]> {
  const supabase = await createClient();

  const [{ data: categoryRows }, { nominees }] = await Promise.all([
    // `*` rather than a column list on purpose: it cannot fail against a
    // database that predates a column this code reads, which keeps the screen
    // rendering through the window between a deploy and its migration.
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    listNominees(),
  ]);

  const categories = (categoryRows ?? []) as (Category & { voting_paused?: boolean })[];
  const byCategory = new Map<number, NomineeWithCategory[]>();
  for (const nominee of nominees) {
    const bucket = byCategory.get(nominee.category_id);
    if (bucket) bucket.push(nominee);
    else byCategory.set(nominee.category_id, [nominee]);
  }

  return categories.map((category) => {
    const own = byCategory.get(category.id) ?? [];
    return {
      ...category,
      voting_paused: category.voting_paused ?? false,
      nominees: own,
      publishedCount: own.filter((n) => n.is_published).length,
    };
  });
}

/**
 * Exactly the columns a public card is made of.
 *
 * Spelled out rather than `*` because `*` on this table would also return the
 * nominee's notification email and the id of her applicant row. The database
 * refuses those to `anon` regardless -- the grant in the migration is
 * column-level -- but asking for them would turn a page render into a
 * permission error, and naming them here is what keeps the two definitions
 * visibly in step.
 */
// One unbroken literal: supabase-js parses this string at the type level, and a
// concatenation is opaque to it -- the query would come back typed as an error.
// prettier-ignore
const PUBLIC_SELECT = "id, category_id, display_name, business_name, area_location, bio, photo_path, social_instagram, social_facebook, social_website, social_whatsapp, sort_order, created_at";

/** A nominee as a voting page sees her. Notably absent: applicant_id and the
 *  whole notification trail. */
export type PublicNominee = {
  id: string;
  category_id: number;
  display_name: string;
  business_name: string;
  area_location: string | null;
  bio: string | null;
  photo_path: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_website: string | null;
  social_whatsapp: string | null;
  sort_order: number;
  created_at: string;
};

/**
 * The public category page (section 6). Reads as `anon` through the RLS policy,
 * which is what limits this to published nominees in an active category -- the
 * row filter is the database's, not this function's.
 */
export async function publicCategoryPage(slug: string): Promise<{
  category: (Pick<Category, "id" | "name" | "slug"> & { voting_paused: boolean }) | null;
  nominees: PublicNominee[];
}> {
  const supabase = createPublicClient();

  // `*` for the same reason as the admin listing: it cannot fail against a
  // database that predates a column this code reads.
  const { data: row } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const category = row as
    | (Pick<Category, "id" | "name" | "slug"> & { voting_paused?: boolean })
    | null;

  if (!category) return { category: null, nominees: [] };

  const { data } = await supabase
    .from("nominees")
    .select(PUBLIC_SELECT)
    .eq("category_id", category.id)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      voting_paused: category.voting_paused ?? false,
    },
    nominees: (data ?? []) as PublicNominee[],
  };
}

/**
 * Signed URLs for nominee photos. The bucket stays private even for the public
 * voting page: the page is server-rendered per request, so it can hand the
 * browser a fresh short-lived URL without ever making the bucket readable.
 */
export async function signNomineePhotos(
  paths: (string | null)[],
  expiresIn = 60 * 30,
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

/** Totals for the Nominees screen tiles. */
export async function nomineeCounts(): Promise<{
  total: number;
  published: number;
  hidden: number;
  notified: number;
  failed: number;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nominees")
    .select("is_published, notified_at, notify_error");

  const rows = (data ?? []) as {
    is_published: boolean;
    notified_at: string | null;
    notify_error: string | null;
  }[];

  return {
    total: rows.length,
    published: rows.filter((r) => r.is_published).length,
    hidden: rows.filter((r) => !r.is_published).length,
    notified: rows.filter((r) => r.notified_at).length,
    failed: rows.filter((r) => !r.notified_at && r.notify_error).length,
  };
}
