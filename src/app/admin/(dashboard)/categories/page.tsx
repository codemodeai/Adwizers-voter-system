import type { Metadata } from "next";
import Link from "next/link";

import { CategoryCard } from "@/components/admin/CategoryCard";
import { NewCategoryForm } from "@/components/admin/NewCategoryForm";
import { listCategoriesWithNominees, signNomineePhotos } from "@/lib/nominees";

export const metadata: Metadata = {
  title: "Categories · AWE Awards 2026",
  robots: { index: false },
};

/**
 * Categories (Final Plan section 5).
 *
 * Each category is a full-width box holding its own nominee cards. Categories
 * have no public page or link: votes are cast only on each nominee's personal
 * link, which lives on the Nominees screen.
 */
export default async function CategoriesPage() {
  const groups = await listCategoriesWithNominees();

  const photoUrls = await signNomineePhotos(
    groups.flatMap((g) => g.nominees.map((n) => n.photo_path)),
  );

  const totalLive = groups.reduce((sum, g) => sum + (g.is_active ? g.publishedCount : 0), 0);
  const hiddenCount = groups.filter((g) => !g.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Categories</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Categories group the nominees. There is no category voting page — voting happens only
            on each nominee&rsquo;s own link. Copy or send those from{" "}
            <Link href="/admin/nominees" className="font-semibold text-magenta-royal hover:underline">
              Nominees
            </Link>
            .
          </p>
          <p className="mt-2 text-[13px] text-ink-muted">
            <span className="font-semibold text-charcoal">{groups.length}</span> categories ·{" "}
            <span className="font-semibold text-magenta-royal">{totalLive}</span> nominee
            {totalLive === 1 ? "" : "s"} live
            {hiddenCount > 0 && ` · ${hiddenCount} category hidden`}
          </p>
        </div>

        <div className="pt-1">
          <NewCategoryForm />
        </div>
      </div>

      <ul className="space-y-3">
        {groups.map((group, index) => (
          <CategoryCard
            key={group.id}
            id={group.id}
            name={group.name}
            slug={group.slug}
            isActive={group.is_active}
            nominees={group.nominees.map((n) => ({
              id: n.id,
              display_name: n.display_name,
              business_name: n.business_name,
              area_location: n.area_location,
              is_published: n.is_published,
              photo_path: n.photo_path,
              code: n.code,
            }))}
            photoUrls={photoUrls}
            first={index === 0}
            last={index === groups.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}
