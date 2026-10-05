import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { leaderboard, nomineeVotes } from "@/lib/leaderboard";
import { displayMobile } from "@/lib/phone";
import { categoryStandings } from "@/lib/results";
import { selectAll } from "@/lib/selectAll";

/**
 * CSV export (Final Plan section 12).
 *
 * A route handler rather than a server action, because the deliverable is a
 * file: this can set Content-Disposition and let the browser save it, which a
 * server action returning a string cannot do without shipping the whole export
 * through React state first.
 *
 * `requireAdmin()` runs here for the same reason it runs in every action -- a
 * route handler is a public URL, and this one would otherwise hand out every
 * applicant's phone number to anyone who guessed the path.
 */
export const dynamic = "force-dynamic";

type Dataset =
  | "applicants"
  | "nominees"
  | "votes"
  | "category-summary"
  | "leaderboard"
  | "nominee-votes"
  | "backup";

const DATASETS: Dataset[] = [
  "applicants",
  "nominees",
  "votes",
  "category-summary",
  "leaderboard",
  "nominee-votes",
  "backup",
];

/**
 * One CSV field.
 *
 * Two things beyond quoting. A value starting with =, +, - or @ is prefixed
 * with a quote, because Excel and Sheets execute those as formulas -- a name
 * field is not a place to let a spreadsheet run something. And newlines inside
 * a quoted field are left alone, which is valid CSV and preserves long answers
 * from the entry form.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = Array.isArray(value) ? value.join("; ") : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.map(cell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(","));
  // BOM: without it Excel opens UTF-8 as the local codepage and mangles every
  // rupee sign and non-ASCII name in the file.
  return "﻿" + lines.join("\r\n");
}

function csvResponse(body: string, filename: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="awe-${filename}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const { supabase } = await requireAdmin();
  const { dataset } = await params;

  if (!DATASETS.includes(dataset as Dataset)) {
    return NextResponse.json({ error: "Unknown dataset." }, { status: 404 });
  }

  if (dataset === "applicants") {
    const { data, error } = await supabase
      .from("applicants")
      .select("*, categories(name)")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = ((data ?? []) as Record<string, unknown>[]).map((a) => ({
      ...a,
      category: (a.categories as { name?: string } | null)?.name ?? "",
      categories: undefined,
    }));

    return csvResponse(
      toCsv(rows, [
        "id", "form_type", "full_name", "whatsapp_number", "email", "area_location",
        "business_name", "profession", "category", "category_other", "stall_category",
        "years_in_business", "business_journey", "proudest_achievement", "business_about",
        "stall_products", "stall_requirements", "stall_goals",
        "social_instagram", "social_facebook", "social_website", "social_whatsapp",
        "interested_in_nomination", "wants_whatsapp_updates",
        "fee_agreed_at", "fee_amount_inr",
        "nomination_declaration_at", "terms_accepted_at", "communication_consent_at",
        "status", "payment_received_at", "admin_notes", "created_at",
      ]),
      "applicants",
    );
  }

  if (dataset === "nominees") {
    const { data, error } = await supabase
      .from("nominees")
      .select("*, categories(name), applicants(full_name, email, whatsapp_number)")
      .order("sort_order", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = ((data ?? []) as Record<string, unknown>[]).map((n) => ({
      ...n,
      category: (n.categories as { name?: string } | null)?.name ?? "",
      applicant_name: (n.applicants as { full_name?: string } | null)?.full_name ?? "",
      applicant_email: (n.applicants as { email?: string } | null)?.email ?? "",
      applicant_whatsapp: (n.applicants as { whatsapp_number?: string } | null)?.whatsapp_number ?? "",
    }));

    return csvResponse(
      toCsv(rows, [
        "code", "id", "display_name", "business_name", "category", "area_location", "bio",
        "is_published", "sort_order",
        "applicant_id", "applicant_name", "applicant_email", "applicant_whatsapp",
        "social_instagram", "social_facebook", "social_website", "social_whatsapp",
        "notified_at", "notify_email", "notify_error", "created_at",
      ]),
      "nominees",
    );
  }

  if (dataset === "votes") {
    // Paged: a single select stops at Supabase's 1,000-row cap without an
    // error, which would make this file quietly incomplete.
    const { data, error } = await selectAll<Record<string, unknown>>((from, to) =>
      supabase
        .from("votes")
        .select("*, nominees(code, display_name, business_name), categories(name)")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );

    // The votes table may not exist yet; say so rather than returning an
    // empty file that looks like "nobody voted".
    if (error) {
      return NextResponse.json(
        { error: `Vote data is not available: ${error.message}` },
        { status: 503 },
      );
    }

    // Newest first, as before; read oldest first so paging is stable.
    const rows = data.reverse().map((v) => ({
      ...v,
      voter_mobile: displayMobile(v.voter_mobile as string | null),
      nominee_code: (v.nominees as { code?: string } | null)?.code ?? "",
      nominee: (v.nominees as { display_name?: string } | null)?.display_name ?? "",
      nominee_business: (v.nominees as { business_name?: string } | null)?.business_name ?? "",
      category: (v.categories as { name?: string } | null)?.name ?? "",
    }));

    return csvResponse(
      toCsv(rows, [
        "vote_ref", "created_at", "category", "nominee_code", "nominee", "nominee_business",
        "voter_name", "voter_mobile", "voter_email", "voter_location",
        "device_id", "ip_hash", "nominee_id", "category_id", "id",
      ]),
      "votes",
    );
  }

  if (dataset === "category-summary") {
    let standings: Awaited<ReturnType<typeof categoryStandings>>;
    try {
      standings = await categoryStandings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return NextResponse.json({ error: `Vote data is not available: ${message}` }, { status: 503 });
    }

    // A category with no nominees still gets a row, so the summary lists every
    // category rather than silently omitting the empty ones.
    const rows = standings.flatMap((category): Record<string, unknown>[] =>
      category.rows.length === 0
        ? [
            {
              category: category.name,
              category_total_votes: category.totalVotes,
              rank: "",
              nominee: "",
              business: "",
              votes: "",
            },
          ]
        : category.rows.map((row) => ({
            category: category.name,
            category_total_votes: category.totalVotes,
            rank: row.rank,
            nominee: row.displayName,
            business: row.businessName,
            votes: row.votes,
          })),
    );

    return csvResponse(
      toCsv(rows, ["category", "category_total_votes", "rank", "nominee", "business", "votes"]),
      "category-summary",
    );
  }

  if (dataset === "leaderboard") {
    const board = await leaderboard();
    if (board.votesUnavailable) {
      return NextResponse.json({ error: "Vote data is not available." }, { status: 503 });
    }

    const rows = board.rows.map((row) => ({
      overall_rank: row.rank,
      category: row.categoryName,
      category_rank: row.categoryRank,
      nominee_code: row.code ?? "",
      nominee: row.displayName,
      business: row.businessName,
      published: row.isPublished,
      votes: row.votes,
      votes_last_24h: row.votesLast24h,
      last_vote_at: row.lastVoteAt ?? "",
    }));

    return csvResponse(
      toCsv(rows, [
        "overall_rank", "category", "category_rank", "nominee_code", "nominee", "business",
        "published", "votes", "votes_last_24h", "last_vote_at",
      ]),
      "leaderboard",
    );
  }

  if (dataset === "nominee-votes") {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    // A uuid, checked before it reaches a query.
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Choose a nominee to export." }, { status: 400 });
    }

    const detail = await nomineeVotes(id);
    if (!detail) return NextResponse.json({ error: "Nominee not found." }, { status: 404 });
    if (detail.error) {
      return NextResponse.json(
        { error: `Vote data is not available: ${detail.error}` },
        { status: 503 },
      );
    }

    const { nominee } = detail;
    const rows = detail.votes.map((vote) => ({
      ...vote,
      voter_mobile: displayMobile(vote.voter_mobile),
      nominee_code: nominee.code ?? "",
      nominee: nominee.display_name,
      business: nominee.business_name,
      category: nominee.categories?.name ?? "",
    }));

    // Named after her number, so a folder of these sorts and reads sensibly.
    const name = (nominee.code ?? nominee.display_name)
      .replace(/[^A-Za-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return csvResponse(
      toCsv(rows, [
        "vote_ref", "created_at", "nominee_code", "nominee", "business", "category",
        "voter_name", "voter_mobile", "voter_email", "voter_location",
      ]),
      `${name || "nominee"}-votes`,
    );
  }

  // Manual backup (section 13). Supabase's free tier has no managed backups, so
  // this is the free-tier-compatible option the plan names: one JSON file with
  // everything, downloadable on demand.
  // The three tables that grow are read in pages, so the backup is never
  // silently cut off at Supabase's 1,000-row cap.
  const everything = (table: "applicants" | "nominees" | "votes") =>
    selectAll<Record<string, unknown>>((from, to) =>
      supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );

  const [applicants, nominees, categories, votes, winners, settings] = await Promise.all([
    everything("applicants"),
    everything("nominees"),
    supabase.from("categories").select("*"),
    everything("votes"),
    supabase.from("published_winners").select("*"),
    supabase.from("voting_settings").select("*"),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const payload = {
    exported_at: new Date().toISOString(),
    note: "AWE Awards 2026 manual backup. Tables that failed to read appear as null.",
    applicants: applicants.error ? null : applicants.data,
    nominees: nominees.error ? null : nominees.data,
    categories: categories.data ?? null,
    votes: votes.error ? null : votes.data,
    published_winners: winners.data ?? null,
    voting_settings: settings.data ?? null,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="awe-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
