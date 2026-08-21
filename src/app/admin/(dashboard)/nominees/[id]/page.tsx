import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NomineeEditor } from "@/components/admin/NomineeEditor";
import { NotifyBadge } from "@/components/admin/NotifyBadge";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { listCategories } from "@/lib/applicants";
import { categoryVoteUrl, getNominee, signNomineePhotos } from "@/lib/nominees";
import { notifyState } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nominee · AWE Awards 2026",
  robots: { index: false },
};

export default async function NomineePage({ params }: PageProps<"/admin/nominees/[id]">) {
  const { id } = await params;

  const [nominee, categories] = await Promise.all([getNominee(id), listCategories()]);
  if (!nominee) notFound();

  const photoUrls = await signNomineePhotos([nominee.photo_path]);
  const photoUrl = nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/nominees"
          className="text-[13px] font-medium text-ink-muted hover:text-purple-royal"
        >
          ← All nominees
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-purple-royal">
              {nominee.display_name}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {nominee.business_name}
              {nominee.categories ? ` · ${nominee.categories.name}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <PublishToggle id={nominee.id} published={nominee.is_published} size="md" />
            <NotifyBadge
              id={nominee.id}
              state={notifyState(nominee)}
              error={nominee.notify_error}
              sentAt={nominee.notified_at}
            />
          </div>
        </div>
      </div>

      {/* The two things this screen is not: it is not her entry, and it is not
        * her own page. Both get a link rather than an explanation. */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px]">
        <Link
          href={`/admin/applicants/${nominee.applicant_id}`}
          className="font-semibold text-magenta-royal hover:underline"
        >
          Original entry
        </Link>
        {nominee.categories && (
          <a
            href={categoryVoteUrl(nominee.categories.slug)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-magenta-royal hover:underline"
          >
            Her category page ↗
          </a>
        )}
        <span className="text-ink-muted">
          Nominees have no link of their own — she appears as a card on that page.
        </span>
      </div>

      <NomineeEditor nominee={nominee} categories={categories} photoUrl={photoUrl} />
    </div>
  );
}
