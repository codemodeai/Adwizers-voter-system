#!/usr/bin/env node
/**
 * Runs a Next command with APP_TARGET set, so the two-domain split can be
 * driven locally the same way it runs in production.
 *
 *   node scripts/with-target.mjs form  dev
 *   node scripts/with-target.mjs admin dev --port 3001
 *   node scripts/with-target.mjs admin build
 *
 * A plain `APP_TARGET=form next dev` prefix is a bash-ism that cmd.exe and
 * PowerShell both reject, and this project is developed on Windows -- hence a
 * wrapper rather than an inline assignment in package.json.
 *
 * For `dev` only, the sibling origins default to the two local ports below, so
 * the cross-domain redirects are exercisable without editing .env.local. Any
 * value already in the environment wins, and production builds get nothing --
 * there the origins come from the Vercel project settings.
 */
import { spawn } from "node:child_process";

const TARGETS = ["form", "admin", "all"];
const LOCAL_FORM_ORIGIN = "http://localhost:3000";
const LOCAL_ADMIN_ORIGIN = "http://localhost:3001";

const [target, command, ...rest] = process.argv.slice(2);

if (!TARGETS.includes(target) || !command) {
  console.error(
    `Usage: node scripts/with-target.mjs <${TARGETS.join("|")}> <next-command> [args...]`,
  );
  process.exit(1);
}

const env = { ...process.env, APP_TARGET: target };

if (command === "dev") {
  env.FORM_ORIGIN ??= LOCAL_FORM_ORIGIN;
  env.ADMIN_ORIGIN ??= LOCAL_ADMIN_ORIGIN;
}

const child = spawn("next", [command, ...rest], {
  env,
  stdio: "inherit",
  shell: true, // resolves next.cmd on Windows
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
