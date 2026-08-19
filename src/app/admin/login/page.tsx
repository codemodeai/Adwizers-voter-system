import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign in · AWE Awards 2026",
  robots: { index: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/admin/applicants";

  return (
    <main className="flex flex-1 items-center justify-center bg-purple-royal px-5 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-champagne">
            Adwizers Women Empowerment
          </p>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white">
            AWE Awards 2026
          </h1>
          <p className="mt-1.5 text-sm text-white/60">Admin Dashboard</p>
        </div>

        <div className="rounded-2xl bg-surface p-7 shadow-xl">
          <LoginForm nextPath={nextPath} />
        </div>
      </div>
    </main>
  );
}
