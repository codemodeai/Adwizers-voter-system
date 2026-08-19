import type { Metadata } from "next";

import { DarkShell } from "@/components/DarkShell";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import { RegistrationForm } from "./RegistrationForm";

export const metadata: Metadata = {
  title: "Register · AWE Awards 2026",
  description:
    "Enter the AWE Awards 2026 — celebrating women entrepreneurs. Submit your business for nomination.",
};

export default async function RegisterPage() {
  // Active categories are publicly readable by RLS policy, so the anon client
  // is enough here -- no service role needed to render the form.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const categories = (data ?? []) as Category[];

  return (
    <DarkShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-5 sm:py-12">
        <div className="mb-6 text-center sm:mb-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Nominations Open
          </p>
          <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-heading sm:mt-2.5 sm:text-4xl">
            Enter the Awards
          </h1>
          <p className="mx-auto mt-2.5 max-w-lg text-sm text-ink-muted sm:text-[15px]">
            Five short steps. Everything you share here is reviewed by our team before nomination.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-accent/30 bg-accent-soft px-5 py-4 text-sm text-accent">
            We could not load the entry form right now. Please refresh the page, or try again
            shortly.
          </div>
        ) : (
          <RegistrationForm categories={categories} />
        )}
      </main>

      <footer className="border-t border-white/10 py-5 text-center text-[13px] text-ink-muted">
        AWE Awards 2026 · Adwizers Women Empowerment
      </footer>
    </DarkShell>
  );
}
