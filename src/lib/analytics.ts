import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard analytics (Final Plan section 5).
 *
 * Every query here runs through the signed-in admin's session, so RLS is what
 * keeps vote data admin-only -- section 9 puts that guarantee at the database
 * rather than in this file.
 *
 * Counts are computed with `head: true` wherever the rows themselves are not
 * needed, so a tally never drags the table across the wire.
 */

export type VotesByCategory = {
  categoryId: number;
  name: string;
  slug: string;
  isActive: boolean;
  votes: number;
  nominees: number;
};

export type AnalyticsSummary = {
  nominees: number;
  publishedNominees: number;
  categories: number;
  activeCategories: number;
  votes: number;
  uniqueVoters: number;
  blockedAttempts: number;
  byCategory: VotesByCategory[];
  topNominees: { id: string; name: string; business: string; category: string; votes: number }[];
  /** True when the votes table is not reachable -- i.e. the migration has not
   *  run yet. Lets the screen say so instead of showing a confident zero. */
  votesUnavailable: boolean;
};

export async function analyticsSummary(): Promise<AnalyticsSummary> {
  const supabase = await createClient();

  const [categoriesRes, nomineesRes, votesRes, attemptsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug, is_active").order("sort_order"),
    supabase.from("nominees").select("id, category_id, display_name, business_name, is_published"),
    // Vote rows, not a count: the by-category tally, unique-voter count and
    // top-nominee list all come from this one read rather than four.
    supabase.from("votes").select("nominee_id, category_id, voter_email"),
    supabase.from("vote_attempts").select("id", { count: "exact", head: true }),
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
    is_published: boolean;
  }[];

  const votesUnavailable = Boolean(votesRes.error);
  const votes = (votesRes.data ?? []) as {
    nominee_id: string;
    category_id: number;
    voter_email: string;
  }[];

  const votesPerCategory = new Map<number, number>();
  const votesPerNominee = new Map<string, number>();
  const voters = new Set<string>();

  for (const vote of votes) {
    votesPerCategory.set(vote.category_id, (votesPerCategory.get(vote.category_id) ?? 0) + 1);
    votesPerNominee.set(vote.nominee_id, (votesPerNominee.get(vote.nominee_id) ?? 0) + 1);
    // Section 8 verifies the email, so it is the closest thing to an identity
    // this system has. Lower-cased for the same reason the unique index is.
    voters.add(vote.voter_email.trim().toLowerCase());
  }

  const nomineesPerCategory = new Map<number, number>();
  for (const nominee of nominees) {
    nomineesPerCategory.set(
      nominee.category_id,
      (nomineesPerCategory.get(nominee.category_id) ?? 0) + 1,
    );
  }

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const byCategory: VotesByCategory[] = categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    slug: c.slug,
    isActive: c.is_active,
    votes: votesPerCategory.get(c.id) ?? 0,
    nominees: nomineesPerCategory.get(c.id) ?? 0,
  }));

  const topNominees = nominees
    .map((n) => ({
      id: n.id,
      name: n.display_name,
      business: n.business_name,
      category: categoryName.get(n.category_id) ?? "—",
      votes: votesPerNominee.get(n.id) ?? 0,
    }))
    .filter((n) => n.votes > 0)
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 10);

  return {
    nominees: nominees.length,
    publishedNominees: nominees.filter((n) => n.is_published).length,
    categories: categories.length,
    activeCategories: categories.filter((c) => c.is_active).length,
    votes: votes.length,
    uniqueVoters: voters.size,
    blockedAttempts: attemptsRes.count ?? 0,
    byCategory,
    topNominees,
    votesUnavailable,
  };
}
