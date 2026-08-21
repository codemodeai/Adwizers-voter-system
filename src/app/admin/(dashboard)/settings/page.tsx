import type { Metadata } from "next";
import Link from "next/link";

import { VotingRulesForm } from "@/components/admin/VotingRulesForm";
import { resendConfigured, usingTestSender } from "@/lib/email/resend";
import { ADMIN_ORIGIN, FORM_ORIGIN } from "@/lib/target";
import { getVotingRules, getVotingSettings, VOTING_STATUS_LABEL } from "@/lib/voting";

export const metadata: Metadata = {
  title: "Settings · AWE Awards 2026",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

function Row({
  label,
  value,
  ok,
  note,
}: {
  label: string;
  value: string;
  ok: boolean;
  note?: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal">{label}</p>
        {note && <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{note}</p>}
      </div>
      <span
        className={`shrink-0 rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${
          ok
            ? "bg-gold-soft text-gold-champagne ring-gold-champagne/25"
            : "bg-magenta-soft text-magenta-dark ring-magenta-royal/20"
        }`}
      >
        {value}
      </span>
    </li>
  );
}

/**
 * Settings (Final Plan section 5): voting rules, security thresholds, and the
 * manual backup trigger.
 *
 * The configuration panel below it exists because this project's failure mode
 * is silent: a missing RESEND_FROM does not break anything, it just means every
 * nominee is told nothing while the dashboard says "Emailed". Surfacing what is
 * and is not configured turns that into something visible.
 */
export default async function SettingsPage() {
  const [rules, settings] = await Promise.all([getVotingRules(), getVotingSettings()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          The rules that govern voting, and what this deployment currently has configured.
        </p>
      </div>

      {/* ---- voting rules (sections 5, 8) ------------------------- */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
          Voting rules &amp; security thresholds
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] text-ink-muted">
          These take effect immediately, without a deploy — which is the point: if a live vote is
          being flooded, the limits need tightening in seconds.
        </p>
        <div className="mt-5">
          <VotingRulesForm rules={rules} />
        </div>
      </section>

      {/* ---- configuration ---------------------------------------- */}
      <section className="rounded-2xl border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Configuration
          </h2>
        </header>

        <ul className="divide-y divide-line">
          <Row
            label="Nominee email (Resend)"
            value={resendConfigured() ? "Connected" : "Not configured"}
            ok={resendConfigured()}
            note={
              resendConfigured()
                ? undefined
                : "RESEND_API_KEY is unset. Promotions still work; nobody is notified."
            }
          />
          <Row
            label="Sending address"
            value={
              !resendConfigured() ? "—" : usingTestSender() ? "Test sender" : "Verified domain"
            }
            ok={resendConfigured() && !usingTestSender()}
            note={
              resendConfigured() && usingTestSender()
                ? "RESEND_FROM is unset, so mail only reaches the Resend account owner. Everyone else shows as sent and receives nothing."
                : undefined
            }
          />
          <Row
            label="Public form domain"
            value={FORM_ORIGIN ? "Set" : "Not set"}
            ok={Boolean(FORM_ORIGIN)}
            note={
              FORM_ORIGIN ??
              "FORM_ORIGIN is unset, so category links render as paths and are useless when shared."
            }
          />
          <Row
            label="Dashboard domain"
            value={ADMIN_ORIGIN ? "Set" : "Not set"}
            ok={Boolean(ADMIN_ORIGIN)}
            note={ADMIN_ORIGIN ?? undefined}
          />
          <Row
            label="Voting"
            value={VOTING_STATUS_LABEL[settings.status]}
            ok={settings.status !== "not_started"}
            note="Change this in Voting Control."
          />
        </ul>
      </section>

      {/* ---- backup (section 13) ---------------------------------- */}
      <section className="rounded-2xl border border-gold-champagne/30 bg-gold-soft p-5">
        <h2 className="text-[15px] font-bold text-gold-champagne">Backup</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-gold-champagne/90">
          There is no managed backup on Supabase&rsquo;s free tier and no point-in-time restore. The
          manual export is the whole safety net — take one before any schema change and keep it off
          this machine.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {/* A download, not a navigation: Link would try a client-side
            * transition to a route handler that returns a file. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/admin/export/backup"
            className="inline-flex items-center rounded-lg bg-gold-champagne px-5 py-2.5 text-sm
                       font-semibold text-white transition-opacity hover:opacity-90"
          >
            Download full backup (JSON)
          </a>
          <Link
            href="/admin/export"
            className="inline-flex items-center rounded-lg bg-white/70 px-4 py-2.5 text-sm
                       font-semibold text-gold-champagne ring-1 ring-inset ring-gold-champagne/30
                       hover:bg-white"
          >
            All exports
          </Link>
        </div>
      </section>

      <p className="text-[12px] leading-relaxed text-ink-muted">
        The rate limits and verification window are stored in the database and read by the ballot
        when it lands — they are live settings, not documentation.
      </p>
    </div>
  );
}
