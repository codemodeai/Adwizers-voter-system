import "server-only";

import { selectAll } from "@/lib/selectAll";
import { createClient } from "@/lib/supabase/server";

/**
 * The admin leaderboard: every nominee with her vote count and where she
 * stands, overall and within her category.
 *
 * Admin-only by construction -- every read goes through the signed-in admin's
 * session, and `anon` has no access to the votes table at all (section 9), so
 * there is no public path to these numbers.
 *
 * Ranked with the same tie rule as Results: equal votes are ordered by who was
 * promoted first, so two nominees on the same count never swap places between
 * page loads, and this screen and the winner preview always agree.
 */

export type LeaderboardRow = {
  id: string;
  code: string | null;
  displayName: string;
  businessName: string;
  isPublished: boolean;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  votes: number;
  /** Votes in the 24 hours before the page was loaded. */
  votesLast24h: number;
  lastVoteAt: string | null;
  /** 1-based, across every nominee. */
  rank: number;
  /** 1-based, within her category. */
  categoryRank: number;
};

export type Leaderboard = {
  rows: LeaderboardRow[];
  categories: { id: number; name: string; slug: string }[];
  totalVotes: number;
  votesLast24h: number;
  /** True when the votes table could not be read -- the screen says so rather
   *  than showing every nominee on a confident zero. */
  votesUnavailable: boolean;
};

type NomineeRow = {
  id: string;
  code: string | null;
  display_name: string;
  business_name: string;
  is_published: boolean;
  category_id: number;
  created_at: string;
};

type CategoryRow = { id: number; name: string; slug: string; sort_order: number };

export async function leaderboard(): Promise<Leaderboard> {
  const supabase = await createClient();
  const since = Date.now() - 24 * 60 * 60 * 1000;

  const [categoriesRes, nomineesRes, votesRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug, sort_order").order("sort_order"),
    supabase
      .from("nominees")
      .select("id, code, display_name, business_name, is_published, category_id, created_at")
      .order("created_at", { ascending: true }),
    selectAll<{ nominee_id: string; created_at: string }>((from, to) =>
      supabase
        .from("votes")
        .select("nominee_id, created_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const categories = (categoriesRes.data ?? []) as CategoryRow[];
  const nominees = (nomineesRes.data ?? []) as NomineeRow[];
  const votes = votesRes.data;

  const count = new Map<string, number>();
  const recent = new Map<string, number>();
  const last = new Map<string, string>();
  let votesLast24h = 0;

  for (const vote of votes) {
    count.set(vote.nominee_id, (count.get(vote.nominee_id) ?? 0) + 1);
    if (new Date(vote.created_at).getTime() >= since) {
      recent.set(vote.nominee_id, (recent.get(vote.nominee_id) ?? 0) + 1);
      votesLast24h += 1;
    }
    // Read in created_at order, so the last write per nominee is her latest.
    last.set(vote.nominee_id, vote.created_at);
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Nominees arrive in promotion order, and Array.prototype.sort is stable, so
  // sorting by votes alone keeps promotion order as the tie-break.
  const ranked = [...nominees].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0));

  const seenInCategory = new Map<number, number>();
  const rows: LeaderboardRow[] = ranked.map((nominee, index) => {
    const categoryRank = (seenInCategory.get(nominee.category_id) ?? 0) + 1;
    seenInCategory.set(nominee.category_id, categoryRank);
    const category = categoryById.get(nominee.category_id);

    return {
      id: nominee.id,
      code: nominee.code,
      displayName: nominee.display_name,
      businessName: nominee.business_name,
      isPublished: nominee.is_published,
      categoryId: nominee.category_id,
      categoryName: category?.name ?? "—",
      categorySlug: category?.slug ?? "",
      votes: count.get(nominee.id) ?? 0,
      votesLast24h: recent.get(nominee.id) ?? 0,
      lastVoteAt: last.get(nominee.id) ?? null,
      rank: index + 1,
      categoryRank,
    };
  });

  return {
    rows,
    categories: categories.map(({ id, name, slug }) => ({ id, name, slug })),
    totalVotes: votes.length,
    votesLast24h,
    votesUnavailable: Boolean(votesRes.error),
  };
}

export type NomineeVote = {
  id: string;
  vote_ref: string;
  created_at: string;
  voter_name: string;
  voter_mobile: string;
  voter_email: string;
  voter_location: string | null;
};

/**
 * One nominee's votes, newest first, with the attempts that were turned away
 * on her -- the drill-down behind a leaderboard row and its CSV.
 *
 * Returns null when there is no such nominee. A votes read that fails comes
 * back as `error` rather than an empty list, so neither the screen nor the
 * export can imply she has no votes when the truth is "could not read them".
 */
export type NomineeVotes = {
  nominee: {
    id: string;
    code: string | null;
    display_name: string;
    business_name: string;
    is_published: boolean;
    categories: { id: number; name: string; slug: string } | null;
  };
  votes: NomineeVote[];
  blockedAttempts: number;
  error: string | null;
};

export async function nomineeVotes(id: string): Promise<NomineeVotes | null> {
  const supabase = await createClient();

  const { data: nominee } = await supabase
    .from("nominees")
    .select("id, code, display_name, business_name, is_published, categories(id, name, slug)")
    .eq("id", id)
    .maybeSingle();

  if (!nominee) return null;

  const [votesRes, attemptsRes] = await Promise.all([
    selectAll<NomineeVote>((from, to) =>
      supabase
        .from("votes")
        .select("id, vote_ref, created_at, voter_name, voter_mobile, voter_email, voter_location")
        .eq("nominee_id", id)
        // Oldest first while paging, so a vote cast mid-read lands on a later
        // page; reversed below for display.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase
      .from("vote_attempts")
      .select("id", { count: "exact", head: true })
      .eq("nominee_id", id),
  ]);

  return {
    nominee: nominee as unknown as NomineeVotes["nominee"],
    votes: votesRes.data.reverse(),
    blockedAttempts: attemptsRes.count ?? 0,
    error: votesRes.error?.message ?? null,
  };
}
