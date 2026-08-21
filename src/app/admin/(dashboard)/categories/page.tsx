import type { Metadata } from "next";

import { CategoryRow } from "@/components/admin/CategoryRow";
import { NewCategoryForm } from "@/components/admin/NewCategoryForm";
import { categoryVoteUrl, listCategoriesWithNominees, signNomineePhotos } from "@/lib/nominees";
import { FORM_ORIGIN } from "@/lib/target";

export const metadata: Metadata = {
  title: "Categories · AWE Awards 2026",
  robots: { index: false },
};

/**
 * Categories (Final Plan section 5) -- and, in practice, the link screen.
 *
 * Section 6 is emphatic that the shareable link is per category and never per
 * nominee, which makes this the page the client actually opens on the day:
 * fourteen links to copy, each showing who is on it. Everything else here
 * (rename, reorder, hide) is secondary to that.
 */
export default async function CategoriesPage() {
  const groups = await listCategoriesWithNominees();

  const photoUrls = await signNomineePhotos(
    groups.flatMap((g) => g.nominees.map((n) => n.photo_path)),
  );

  const totalLive = groups.reduce((sum, g) => sum + (g.is_active ? g.publishedCount : 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Categories</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Each category has one shareable voting link showing every nominee in it — this is the link
          that gets sent out. Nominees never get a link of their own.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          {groups.length} categories · {totalLive} nominee{totalLive === 1 ? "" : "s"} live across
          them
        </p>
        <NewCategoryForm />
      </div>

      {/* Without FORM_ORIGIN the links below are relative paths, which are
        * useless pasted into WhatsApp. Say so rather than let someone copy one. */}
      {!FORM_ORIGIN && (
        <div className="rounded-xl border border-gold-champagne/30 bg-gold-soft px-4 py-3 text-[13px] leading-relaxed text-gold-champagne">
          <strong className="font-semibold">Links are showing as paths, not full URLs.</strong> Set{" "}
          <code className="font-mono">FORM_ORIGIN</code> on this deployment so the copy button hands
          you a link that works outside the dashboard.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {groups.map((group, index) => (
            <CategoryRow
              key={group.id}
              id={group.id}
              name={group.name}
              slug={group.slug}
              isActive={group.is_active}
              voteUrl={categoryVoteUrl(group.slug)}
              nominees={group.nominees.map((n) => ({
                id: n.id,
                display_name: n.display_name,
                business_name: n.business_name,
                is_published: n.is_published,
                photo_path: n.photo_path,
              }))}
              photoUrls={photoUrls}
              first={index === 0}
              last={index === groups.length - 1}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
