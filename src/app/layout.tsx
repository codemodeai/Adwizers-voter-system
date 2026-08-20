import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { APP_TARGET } from "@/lib/target";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const isAdminDeployment = APP_TARGET === "admin";

export const metadata: Metadata = {
  title: {
    default: isAdminDeployment ? "AWE Awards 2026 · Admin" : "AWE Awards 2026",
    template: "%s",
  },
  description:
    "AWE Awards 2026 — Adwizers Women Empowerment. Nomination and voting platform.",
  // Belt and braces alongside robots.ts: the dashboard domain must never be
  // indexed, and a page-level tag survives a misconfigured robots.txt.
  ...(isAdminDeployment ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
