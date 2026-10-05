import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formUrl } from "@/lib/target";
import type { Category, NomineeWithCategory } from "@/lib/types";

// The applicant's WhatsApp number rides along so the dashboard can send a
// nominee her link straight into her chat. Admin-only: this select runs under
// the admin's session, where RLS lets it read applicants.
const SELECT = "*, categories(id, name, slug, is_active), applicants(whatsapp_number)";

/**
 * A nominee's own voting link: the one she shares with her customers and
 * community, and the only page a vote is cast from.
 *
 * Keyed on her nominee number (AWE2026-007) rather than a name-based slug. The
 * number already exists for every nominee, is unique, is assigned once by the
 * database and never changes -- so a link printed on a poster cannot be broken
 * by an admin later correcting the spelling of her name.
 */
export function nomineeVoteUrl(code: string): string {
  return formUrl(`/nominee/${code}`);
}

/** Absolute personal link, or null when no public origin is configured --
 *  which is local development, where a relative path in an email is useless. */
export function absoluteNomineeVoteUrl(code: string): string | null {
  const url = nomineeVoteUrl(code);
  return url.startsWith("http") ? url : null;
}

/** The shape the database hands out (AWE2026-001), checked before any query so
 *  a junk path segment never reaches the database. */
const NOMINEE_CODE = /^AWE\d{4}-\d{1,6}$/;

/**
 * A nominee number from a URL, tidied up: people retype links from posters, so
 * `awe2026-007` and a trailing space are both the same nominee. Null when it
 * cannot be a nominee number at all.
 */
export function normaliseNomineeCode(raw: string): string | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // A malformed escape is simply not a code.
  }
  const code = value.trim().toUpperCase();
  return NOMINEE_CODE.test(code) ? code : null;
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

/** A nominee as her voting page sees her. Notably absent: applicant_id and
 *  the whole notification trail. */
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
  /** Her nominee number, which is also her personal link. Null only for a row
   *  that predates the column. */
  code: string | null;
};

export type PublicNomineeCategory = Pick<Category, "id" | "name" | "slug"> & {
  voting_paused: boolean;
};

/**
 * A nominee's personal voting page, by her number.
 *
 * Read with the service role, because the number is not a column `anon` may
 * select. That makes this function responsible for what RLS would otherwise
 * have enforced, so it applies the same rule as the `nominees_public_select`
 * policy -- published, in an active category -- and returns exactly the public
 * card columns, never the notification trail or the applicant id.
 *
 * Null for anything a visitor must not see: no such number, a hidden profile,
 * or a hidden category. All three look the same from outside, deliberately.
 */
export async function publicNomineePage(code: string): Promise<{
  nominee: PublicNominee;
  category: PublicNomineeCategory;
} | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("nominees")
    .select(`${PUBLIC_SELECT}, code`)
    .eq("code", code)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) return null;
  const nominee = data as PublicNominee;

  // `*` for the same reason as the other category reads: it cannot fail
  // against a database that predates the voting_paused column.
  const { data: categoryRow } = await supabase
    .from("categories")
    .select("*")
    .eq("id", nominee.category_id)
    .eq("is_active", true)
    .maybeSingle();

  const category = categoryRow as
    | (Pick<Category, "id" | "name" | "slug"> & { voting_paused?: boolean })
    | null;

  if (!category) return null;

  return {
    nominee,
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      voting_paused: category.voting_paused ?? false,
    },
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
