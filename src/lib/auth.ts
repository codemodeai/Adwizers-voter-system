import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Guard for any server action that reaches past RLS -- notably storage writes,
 * which use the service-role client. Server actions are addressable endpoints,
 * so each one has to re-establish who is calling rather than assume the layout
 * check already ran.
 */
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) redirect("/admin/login");

  return { user, supabase };
}
