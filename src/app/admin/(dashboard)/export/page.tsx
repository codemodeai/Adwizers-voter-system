import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Export · AWE Awards 2026",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const DOWNLOADS = [
  {
    href: "/admin/export/applicants",
    title: "Applicants",
    body: "Every Form 1 and stall submission with all answers, consent timestamps, fee agreement and admin notes.",
    format: "CSV",
  },
  {
    href: "/admin/export/nominees",
    title: "Nominees",
    body: "Public profiles with their category, publish state, notification trail, and the applicant each came from.",
    format: "CSV",
  },
  {
    href: "/admin/export/votes",
    title: "Raw vote data",
    body: "One row per vote: receipt reference, nominee, category, voter details and the duplicate-check signals.",
    format: "CSV",
  },
  {
    href: "/admin/export/category-summary",
    title: "Category-wise summary",
    body: "Votes per category with the ranked nominees inside each — the tally sheet, not the raw rows.",
    format: "CSV",
  },
];

/**
 * Export (Final Plan section 12) and the manual backup from section 13.
 *
 * Plain anchors, not fetch-and-save. Each one hits a route handler that sets
 * Content-Disposition, so the browser does the download natively -- no
 * client-side blob juggling, and the file streams from the server rather than
 * passing through React state on the way.
 */
export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Export</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Download the data at any time. Files are UTF-8 CSV with a byte-order mark, so Excel opens
          them with rupee signs and names intact rather than mangled.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {DOWNLOADS.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5
                         transition-colors hover:border-magenta-royal/30 hover:bg-magenta-soft/30"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-bold text-purple-royal">{item.title}</h2>
                <span
                  className="shrink-0 rounded-md bg-purple-soft px-2 py-0.5 text-[11px]
                             font-bold uppercase tracking-wide text-purple-royal"
                >
                  {item.format}
                </span>
              </div>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-muted">{item.body}</p>
              <span className="mt-3 text-[13px] font-semibold text-magenta-royal">Download ↓</span>
            </a>
          </li>
        ))}
      </ul>

      {/* ---- backup (section 13) ---------------------------------- */}
      <section className="rounded-2xl border border-gold-champagne/30 bg-gold-soft p-5">
        <h2 className="text-[15px] font-bold text-gold-champagne">Full backup</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-gold-champagne/90">
          Supabase&rsquo;s free tier has no managed backups and no point-in-time restore. This is
          the free-tier alternative the plan names: one JSON file containing applicants, nominees,
          categories, votes, published winners and settings. There is real applicant data now —
          take one regularly and keep it somewhere off this machine.
        </p>
        {/* A download, not a navigation: Link would try a client-side
          * transition to a route handler that returns a file. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/export/backup"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-champagne px-5 py-2.5
                     text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Download full backup (JSON)
        </a>
      </section>

      <p className="text-[12px] leading-relaxed text-ink-muted">
        Vote exports return an error rather than an empty file when the votes table is unreachable,
        so a download can never quietly imply nobody voted. Values starting with{" "}
        <code className="font-mono">=</code>, <code className="font-mono">+</code>,{" "}
        <code className="font-mono">-</code> or <code className="font-mono">@</code> are escaped, so
        a spreadsheet cannot execute anything an applicant typed into a form field.
      </p>
    </div>
  );
}
