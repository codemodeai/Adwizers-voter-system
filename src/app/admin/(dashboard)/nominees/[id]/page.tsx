import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NomineeEditor } from "@/components/admin/NomineeEditor";
import { NomineeLinkTools } from "@/components/admin/NomineeLinkTools";
import { NotifyBadge } from "@/components/admin/NotifyBadge";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { listCategories } from "@/lib/applicants";
import { getNominee, nomineeVoteUrl, signNomineePhotos } from "@/lib/nominees";
import { signOriginal } from "@/lib/photoStorage";
import { notifyState } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nominee · AWE Awards 2026",
  robots: { index: false },
};

export default async function NomineePage({ params }: PageProps<"/admin/nominees/[id]">) {
  const { id } = await params;

  const [nominee, categories] = await Promise.all([getNominee(id), listCategories()]);
  if (!nominee) notFound();

  const [photoUrls, originalUrl] = await Promise.all([
    signNomineePhotos([nominee.photo_path]),
    // Only her own crops are undoable from here; a photo still shared with the
    // entry is restored on the entry screen, where its original lives.
    signOriginal(`nominees/${nominee.id}`),
  ]);
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
            {nominee.code && (
              <p className="font-mono text-[12px] font-semibold tracking-wide text-magenta-royal">
                {nominee.code}
              </p>
            )}
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

      {/* Her personal voting link first -- it is the thing most often needed
        * from this screen -- then the way back to her original entry. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Her voting link
          </p>
          {nominee.code ? (
            <div className="mt-1.5">
              <NomineeLinkTools
                url={nomineeVoteUrl(nominee.code)}
                code={nominee.code}
                name={nominee.display_name}
                categoryName={nominee.categories?.name ?? null}
                phone={nominee.applicants?.whatsapp_number ?? null}
                live={nominee.is_published && nominee.categories?.is_active !== false}
                size="md"
              />
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-ink-muted">
              No nominee number yet, so there is no link to share.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 text-[13px]">
          <Link
            href={`/admin/applicants/${nominee.applicant_id}`}
            className="font-semibold text-magenta-royal hover:underline"
          >
            Original entry
          </Link>
        </div>
      </div>

      <NomineeEditor
        nominee={nominee}
        categories={categories}
        photoUrl={photoUrl}
        originalUrl={originalUrl}
      />
    </div>
  );
}
