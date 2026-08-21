import type { Metadata } from "next";
import Link from "next/link";

import { ApplicantAvatar } from "@/components/admin/ApplicantAvatar";
import { ApplicantCard } from "@/components/admin/ApplicantCard";
import { PromoteButton } from "@/components/admin/PromoteButton";
import { ViewToggle, type ApplicantView } from "@/components/admin/ViewToggle";
import { FeeBadge } from "@/components/admin/FeeBadge";
import { PaymentToggle } from "@/components/admin/PaymentToggle";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ApplicantFilters } from "@/components/admin/ApplicantFilters";
import { Pagination } from "@/components/admin/Pagination";
import {
  applicantCounts,
  listApplicants,
  listCategories,
  signLogoUrls,
  PAGE_SIZE_CARDS,
  PAGE_SIZE_TABLE,
} from "@/lib/applicants";
import { categoryLabel, STATUS_LABEL, type ApplicantStatus } from "@/lib/types";
import { formUrl } from "@/lib/target";

export const metadata: Metadata = {
  title: "Applicants · AWE Awards 2026",
  robots: { index: false },
};

const VALID_STATUSES: ApplicantStatus[] = ["new", "payment_received", "promoted", "rejected"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export default async function ApplicantsPage({
  searchParams,
}: PageProps<"/admin/applicants">) {
  const sp = await searchParams;

  const search = typeof sp.q === "string" ? sp.q : "";
  const statusParam = typeof sp.status === "string" ? sp.status : "";
  const status = VALID_STATUSES.includes(statusParam as ApplicantStatus)
    ? (statusParam as ApplicantStatus)
    : undefined;
  const categoryId = typeof sp.category === "string" ? Number(sp.category) || undefined : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) || 1 : 1;
  const view: ApplicantView = sp.view === "cards" ? "cards" : "table";

  const pageSize = view === "cards" ? PAGE_SIZE_CARDS : PAGE_SIZE_TABLE;

  const [{ applicants, total, pageCount, error }, categories, counts] = await Promise.all([
    listApplicants({ search, status, categoryId, page, pageSize }),
    listCategories(),
    applicantCounts(),
  ]);

  // One signing round trip for every thumbnail on this page.
  const logoUrls = await signLogoUrls(applicants.map((a) => a.logo_path));

  const filtered = Boolean(search || status || categoryId);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Applicants</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every Form 1 submission. Open one to edit any field, add notes, or mark payment received.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={counts.total} tone="text-purple-royal" />
        <StatTile label="New" value={counts.new} tone="text-purple-royal" />
        <StatTile label="Paid" value={counts.payment_received} tone="text-gold-champagne" />
        <StatTile label="Promoted" value={counts.promoted} tone="text-magenta-royal" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ApplicantFilters
            categories={categories}
            defaultSearch={search}
            defaultStatus={statusParam}
            defaultCategory={typeof sp.category === "string" ? sp.category : ""}
          />
        </div>
        <div className="lg:pt-3">
          <ViewToggle view={view} />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-magenta-royal/25 bg-magenta-soft px-4 py-3 text-sm text-magenta-dark">
          Could not load applicants: {error}
        </div>
      )}

      {view === "table" && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="border-b border-line bg-canvas">
                <tr className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-center">Payment</th>
                  <th className="px-4 py-3 text-center">Fee</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {applicants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <p className="text-sm font-medium text-charcoal">
                        {filtered ? "No applicants match these filters." : "No applications yet."}
                      </p>
                      <p className="mt-1 text-[13px] text-ink-muted">
                        {filtered ? (
                          <Link
                            href="/admin/applicants"
                            className="underline underline-offset-2 hover:text-purple-royal"
                          >
                            Clear filters
                          </Link>
                        ) : (
                          <>
                            Submissions from the{" "}
                            <Link
                              href={formUrl("/register")}
                              className="underline underline-offset-2 hover:text-purple-royal"
                            >
                              registration form
                            </Link>{" "}
                            appear here.
                          </>
                        )}
                      </p>
                    </td>
                  </tr>
                )}

                {applicants.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-canvas">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ApplicantAvatar
                          url={a.logo_path ? (logoUrls[a.logo_path] ?? null) : null}
                          name={a.full_name}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/applicants/${a.id}`}
                            className="font-semibold text-purple-royal hover:text-magenta-royal"
                          >
                            {a.full_name}
                          </Link>
                          <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                            {a.business_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-charcoal">{categoryLabel(a)}</td>
                    <td className="px-4 py-3 text-[13px] text-charcoal">
                      <p className="tabular-nums">{a.whatsapp_number}</p>
                      <p className="mt-0.5 truncate text-ink-muted" title={a.email}>
                        {a.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-ink-muted">
                      {formatDate(a.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <PaymentToggle id={a.id} status={a.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <FeeBadge
                          agreedAt={a.fee_agreed_at}
                          amount={a.fee_amount_inr}
                          compact
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <PromoteButton id={a.id} status={a.status} />
                        <Link
                          href={`/admin/applicants/${a.id}`}
                          className="text-[13px] font-semibold text-magenta-royal hover:underline"
                        >
                          Review
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {applicants.length === 0 && view === "cards" && (
        <div className="rounded-xl border border-line bg-surface px-4 py-14 text-center">
          <p className="text-sm font-medium text-charcoal">
            {filtered ? "No applicants match these filters." : "No applications yet."}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {filtered ? (
              <Link
                href="/admin/applicants"
                className="underline underline-offset-2 hover:text-purple-royal"
              >
                Clear filters
              </Link>
            ) : (
              <>
                Submissions from the{" "}
                <Link
                  href={formUrl("/register")}
                  className="underline underline-offset-2 hover:text-purple-royal"
                >
                  registration form
                </Link>{" "}
                appear here.
              </>
            )}
          </p>
        </div>
      )}

      {applicants.length > 0 && view === "cards" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {applicants.map((a) => (
            <ApplicantCard
              key={a.id}
              applicant={a}
              logoUrl={a.logo_path ? (logoUrls[a.logo_path] ?? null) : null}
            />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-[13px] text-ink-muted">
            Showing <span className="font-medium text-charcoal">{rangeStart}</span>–
            <span className="font-medium text-charcoal">{rangeEnd}</span> of{" "}
            <span className="font-medium text-charcoal">{total}</span>
            {status && ` · ${STATUS_LABEL[status]}`}
          </p>
          <Pagination page={page} pageCount={pageCount} />
        </div>
      )}
    </div>
  );
}
