import type { Metadata } from "next";
import Link from "next/link";

import { ApplicantAvatar } from "@/components/admin/ApplicantAvatar";
import { NotifyBadge } from "@/components/admin/NotifyBadge";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { StatTile } from "@/components/admin/StatTile";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { resendConfigured, usingTestSender } from "@/lib/email/resend";
import { listCategoriesWithNominees, nomineeCounts, signNomineePhotos } from "@/lib/nominees";
import { notifyState } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nominees · AWE Awards 2026",
  robots: { index: false },
};

/**
 * Nominees (Final Plan section 5), grouped by category rather than listed flat.
 *
 * A nominee has no link of her own -- she is a card on her category's page --
 * so the category is the unit that matters, and grouping is what makes "who is
 * on this page, in what order" answerable at a glance. The flat list that would
 * have been easier to build answers a question nobody has.
 */
export default async function NomineesPage() {
  const [groups, counts] = await Promise.all([listCategoriesWithNominees(), nomineeCounts()]);

  const withNominees = groups.filter((g) => g.nominees.length > 0);
  const photoUrls = await signNomineePhotos(
    withNominees.flatMap((g) => g.nominees.map((n) => n.photo_path)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Nominees</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Applicants promoted to nominee. Each one is a card on her category&rsquo;s voting page —
          edit the public copy here without touching her original entry.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Nominees" value={counts.total} tone="text-purple-royal" />
        <StatTile label="Live" value={counts.published} tone="text-magenta-royal" />
        <StatTile label="Hidden" value={counts.hidden} tone="text-ink-muted" />
        <StatTile label="Emailed" value={counts.notified} tone="text-gold-champagne" />
      </div>

      {/* Two different "email is not working" states, and they need different
        * answers -- one is a missing key, the other is a sender that silently
        * only delivers to the account owner. */}
      {!resendConfigured() && counts.total > 0 && (
        <Notice tone="warn">
          <strong className="font-semibold">Email is not configured.</strong> Promotions still work,
          but no nominee is being notified. Add <code className="font-mono">RESEND_API_KEY</code>{" "}
          (and <code className="font-mono">RESEND_FROM</code>) to the admin project, then use
          &ldquo;Send now&rdquo; on anyone marked <em>Not sent</em>.
        </Notice>
      )}

      {resendConfigured() && usingTestSender() && (
        <Notice tone="warn">
          <strong className="font-semibold">Sending from Resend&rsquo;s test address.</strong> Until{" "}
          <code className="font-mono">RESEND_FROM</code> is set to your verified domain, emails only
          reach the Resend account owner — everyone else will show as sent but receive nothing.
        </Notice>
      )}

      {counts.failed > 0 && (
        <Notice tone="error">
          {counts.failed} nominee{counts.failed === 1 ? "" : "s"} could not be emailed. Each is
          marked <em>Not sent</em> below with a Send button.
        </Notice>
      )}

      {counts.total === 0 && (
        <div className="rounded-xl border border-line bg-surface px-4 py-14 text-center">
          <p className="text-sm font-medium text-charcoal">No nominees yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            Mark an award entry&rsquo;s payment received in{" "}
            <Link
              href="/admin/applicants"
              className="underline underline-offset-2 hover:text-purple-royal"
            >
              Applicants
            </Link>
            , then press Promote. Her card appears here and on her category&rsquo;s voting page.
          </p>
        </div>
      )}

      {withNominees.map((group) => (
        <section key={group.id} className="rounded-xl border border-line bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-purple-royal">{group.name}</h2>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                {group.publishedCount} live
                {group.nominees.length !== group.publishedCount &&
                  ` · ${group.nominees.length - group.publishedCount} hidden`}
                {!group.is_active && " · category hidden"}
              </p>
            </div>
            <Link
              href="/admin/categories"
              className="text-[13px] font-semibold text-magenta-royal hover:underline"
            >
              Category &amp; link
            </Link>
          </header>

          <ul className="divide-y divide-line">
            {group.nominees.map((nominee, index) => (
              <li
                key={nominee.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3"
              >
                <ReorderButtons
                  kind="nominee"
                  id={nominee.id}
                  first={index === 0}
                  last={index === group.nominees.length - 1}
                  label={nominee.display_name}
                />

                <ApplicantAvatar
                  url={nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null}
                  name={nominee.display_name}
                />

                <div className="min-w-[10rem] flex-1">
                  <Link
                    href={`/admin/nominees/${nominee.id}`}
                    className="block truncate font-semibold text-purple-royal hover:text-magenta-royal"
                  >
                    {nominee.display_name}
                  </Link>
                  <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                    {nominee.business_name}
                    {nominee.area_location ? ` · ${nominee.area_location}` : ""}
                  </p>
                  {/* A card with no photo is the one thing that looks broken on
                    * a public voting page, so it is called out here. */}
                  {!nominee.photo_path && (
                    <p className="mt-0.5 text-[12px] font-medium text-magenta-dark">
                      No photo — add one before voting opens
                    </p>
                  )}
                </div>

                <PublishToggle id={nominee.id} published={nominee.is_published} />

                <NotifyBadge
                  id={nominee.id}
                  state={notifyState(nominee)}
                  error={nominee.notify_error}
                  sentAt={nominee.notified_at}
                />

                <Link
                  href={`/admin/nominees/${nominee.id}`}
                  className="text-[13px] font-semibold text-magenta-royal hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: React.ReactNode;
}) {
  const style =
    tone === "warn"
      ? "border-gold-champagne/30 bg-gold-soft text-gold-champagne"
      : "border-magenta-royal/25 bg-magenta-soft text-magenta-dark";
  return (
    <div className={`rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${style}`}>
      {children}
    </div>
  );
}
