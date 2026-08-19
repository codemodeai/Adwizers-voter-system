import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function DashboardLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createClient();

  // getUser() revalidates against Supabase rather than trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  // Being signed in is not the same as being an admin. RLS already blocks a
  // non-admin from reading anything, but bouncing here avoids rendering an
  // empty dashboard that looks broken rather than forbidden.
  const { data: admin } = await supabase
    .from("admins")
    .select("email, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) redirect("/admin/login");

  return (
    <AdminShell adminName={admin.full_name || admin.email}>{children}</AdminShell>
  );
}
