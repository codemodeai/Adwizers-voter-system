import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

/** Section 11 is explicit: Top 5 per category. */
export const WINNERS_PER_CATEGORY = 5;

export type StandingRow = {
  nomineeId: string;
  displayName: string;
  businessName: string;
  photoPath: string | null;
  votes: number;
  rank: number;
};

export type CategoryStandings = {
  categoryId: number;
  name: string;
  slug: string;
  isActive: boolean;
  rows: StandingRow[];
  /** Votes cast in this category, including nominees outside the top five. */
  totalVotes: number;
};

/**
 * The admin-only preview of who is winning (section 11).
 *
 * Ranked here rather than in SQL because the tie rule has to be explicit and
 * inspectable: equal votes are ordered by who was promoted first, so a tie
 * never reshuffles between two page loads. A `order by count desc` alone would
 * leave that to the planner.
 */
export async function categoryStandings(): Promise<CategoryStandings[]> {
  const supabase = await createClient();

  const [categoriesRes, nomineesRes, votesRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug, is_active").order("sort_order"),
    supabase
      .from("nominees")
      .select("id, category_id, display_name, business_name, photo_path, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("votes").select("nominee_id, category_id"),
  ]);

  const categories = (categoriesRes.data ?? []) as {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
  }[];

  const nominees = (nomineesRes.data ?? []) as {
    id: string;
    category_id: number;
    display_name: string;
    business_name: string;
    photo_path: string | null;
    created_at: string;
  }[];

  const votes = (votesRes.data ?? []) as { nominee_id: string; category_id: number }[];

  const perNominee = new Map<string, number>();
  const perCategory = new Map<number, number>();
  for (const vote of votes) {
    perNominee.set(vote.nominee_id, (perNominee.get(vote.nominee_id) ?? 0) + 1);
    perCategory.set(vote.category_id, (perCategory.get(vote.category_id) ?? 0) + 1);
  }

  return categories.map((category) => {
    const own = nominees.filter((n) => n.category_id === category.id);

    const ranked = own
      .map((n) => ({
        nomineeId: n.id,
        displayName: n.display_name,
        businessName: n.business_name,
        photoPath: n.photo_path,
        votes: perNominee.get(n.id) ?? 0,
        createdAt: n.created_at,
      }))
      // Votes descending; ties broken by promotion order, which is stable.
      .sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))
      .slice(0, WINNERS_PER_CATEGORY)
      .map((row, index) => ({
        nomineeId: row.nomineeId,
        displayName: row.displayName,
        businessName: row.businessName,
        photoPath: row.photoPath,
        votes: row.votes,
        rank: index + 1,
      }));

    return {
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      isActive: category.is_active,
      rows: ranked,
      totalVotes: perCategory.get(category.id) ?? 0,
    };
  });
}

export type PublishedWinner = {
  rank: number;
  nominee: {
    id: string;
    display_name: string;
    business_name: string;
    area_location: string | null;
    bio: string | null;
    photo_path: string | null;
  } | null;
};

export type PublishedCategory = {
  categoryId: number;
  name: string;
  slug: string;
  winners: PublishedWinner[];
};

/**
 * The public winner page (section 11), read from the snapshot rather than from
 * votes.
 *
 * This is the whole reason `published_winners` exists: the ranking becomes
 * public at reveal, while the counts stay behind the admin boundary section 9
 * puts them behind. Nothing here can leak a tally, because nothing here reads
 * one.
 */
export async function publishedWinners(): Promise<{
  publishedAt: string | null;
  categories: PublishedCategory[];
}> {
  const supabase = createPublicClient();

  const { data: settings } = await supabase
    .from("voting_settings")
    .select("results_published_at")
    .eq("id", 1)
    .maybeSingle();

  const publishedAt = (settings as { results_published_at: string | null } | null)
    ?.results_published_at ?? null;

  if (!publishedAt) return { publishedAt: null, categories: [] };

  const { data } = await supabase
    .from("published_winners")
    .select(
      "rank, category_id, categories(id, name, slug, sort_order), nominees(id, display_name, business_name, area_location, bio, photo_path)",
    )
    .order("rank", { ascending: true });

  const rows = (data ?? []) as unknown as {
    rank: number;
    category_id: number;
    categories: { id: number; name: string; slug: string; sort_order: number } | null;
    nominees: PublishedWinner["nominee"];
  }[];

  const byCategory = new Map<number, PublishedCategory & { sortOrder: number }>();

  for (const row of rows) {
    if (!row.categories) continue;
    const existing = byCategory.get(row.category_id);
    const entry = existing ?? {
      categoryId: row.category_id,
      name: row.categories.name,
      slug: row.categories.slug,
      sortOrder: row.categories.sort_order,
      winners: [],
    };
    entry.winners.push({ rank: row.rank, nominee: row.nominees });
    byCategory.set(row.category_id, entry);
  }

  const categories: PublishedCategory[] = [...byCategory.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((entry) => ({
      categoryId: entry.categoryId,
      name: entry.name,
      slug: entry.slug,
      winners: entry.winners.sort((a, b) => a.rank - b.rank),
    }));

  return { publishedAt, categories };
}
