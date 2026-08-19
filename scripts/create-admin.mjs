/**
 * Creates the first dashboard admin.
 *
 *   node scripts/create-admin.mjs you@example.com "StrongPassword123" "Your Name"
 *
 * Signing up through Supabase Auth is not enough on its own -- the dashboard
 * also requires a row in `public.admins`, which this script writes. Run it
 * again for each additional admin.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local reader so this works without extra dependencies.
function loadEnv(file = ".env.local") {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Fall through to whatever is already in the environment.
  }
}

loadEnv();

const [email, password, fullName] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> ["Full Name"]');
  process.exit(1);
}
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

let userId = data?.user?.id;

if (error) {
  // Re-running for an existing account should promote it, not fail outright.
  if (!/already/i.test(error.message)) {
    console.error("Could not create the auth user:", error.message);
    process.exit(1);
  }
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) {
    console.error(`User ${email} already exists but could not be found.`);
    process.exit(1);
  }
  console.log(`Auth user already existed — granting dashboard access instead.`);
}

const { error: insertError } = await supabase
  .from("admins")
  .upsert({ user_id: userId, email, full_name: fullName ?? null }, { onConflict: "user_id" });

if (insertError) {
  console.error("Could not add the admins row:", insertError.message);
  process.exit(1);
}

console.log(`✓ ${email} can now sign in at /admin/login`);
