import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicantAvatar } from "@/components/admin/ApplicantAvatar";
import { ApplicantEditor } from "@/components/admin/ApplicantEditor";
import { PaymentToggle } from "@/components/admin/PaymentToggle";
import { PromoteButton } from "@/components/admin/PromoteButton";
import { getApplicant, listCategories, signLogoUrl } from "@/lib/applicants";

export const metadata: Metadata = {
  title: "Review applicant · AWE Awards 2026",
  robots: { index: false },
};

export default async function ApplicantDetailPage({
  params,
}: PageProps<"/admin/applicants/[id]">) {
  const { id } = await params;

  const applicant = await getApplicant(id);
  if (!applicant) notFound();

  const [categories, logoUrl] = await Promise.all([
    listCategories(),
    signLogoUrl(applicant.logo_path),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin/applicants"
            className="text-[13px] font-medium text-ink-muted transition-colors hover:text-purple-royal"
          >
            ← Back to applicants
          </Link>
          <div className="mt-2 flex items-center gap-3.5">
            <ApplicantAvatar url={logoUrl} name={applicant.full_name} size={48} />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-purple-royal">
                {applicant.full_name}
              </h1>
              <p className="mt-0.5 text-sm text-ink-muted">
                {applicant.business_name} · Submitted{" "}
                {new Date(applicant.created_at).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* The two workflow actions worth reaching without scrolling down to
          * the Workflow panel: mark payment, then promote. */}
        <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3">
          <PaymentToggle id={applicant.id} status={applicant.status} size="md" showLabel />
          {applicant.form_type === "award" && (
            <>
              <span aria-hidden="true" className="h-6 w-px bg-line" />
              <PromoteButton id={applicant.id} status={applicant.status} size="md" />
            </>
          )}
        </div>
      </div>

      <ApplicantEditor applicant={applicant} categories={categories} logoUrl={logoUrl} />
    </div>
  );
}
