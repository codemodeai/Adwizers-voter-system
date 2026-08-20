"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resolveAdminEmail } from "@/lib/adminIdentity";
import type { LoginState } from "./state";

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // What was typed in the ID field -- echoed back verbatim on failure, so a
  // rejected sign-in redisplays exactly what the admin entered.
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin/applicants");

  if (!identifier || !password) {
    return { error: "Enter your admin ID and password.", email: identifier };
  }

  // Supabase authenticates by email; a short ID maps onto the ID domain.
  const email = resolveAdminEmail(identifier);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "That ID and password did not match.", email: identifier };
  }

  // Authenticating is not the same as being an admin. Reject anyone who has a
  // Supabase Auth account but no row in `admins`, and drop their session so a
  // stray login cannot linger.
  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    return { error: "This account does not have dashboard access.", email: identifier };
  }

  redirect(next.startsWith("/admin") ? next : "/admin/applicants");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
