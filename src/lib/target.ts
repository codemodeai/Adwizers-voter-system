/**
 * Which half of the platform this deployment is.
 *
 * The public entry form and the admin dashboard ship from this one codebase but
 * run as two Vercel projects on two domains. `APP_TARGET` tells a build which
 * of the two it is; `src/proxy.ts` reads it to decide which paths that
 * deployment will answer, and redirects the rest to its sibling.
 *
 * Leaving `APP_TARGET` unset means "serve both", which is what `npm run dev`
 * gets -- one server on localhost:3000 with the whole app, exactly as it
 * behaved before the split. Nothing below is required for local work.
 *
 * Server-only: every value here comes from a non-`NEXT_PUBLIC_` variable, so
 * importing this from a client component would silently yield `undefined`.
 * Keep the imports in server components, server actions, and the proxy.
 */

export type AppTarget = "form" | "admin" | "all";

function resolveTarget(): AppTarget {
  const raw = process.env.APP_TARGET?.trim().toLowerCase();
  if (!raw) return "all";
  if (raw === "form" || raw === "admin" || raw === "all") return raw;
  throw new Error(
    `Invalid APP_TARGET "${raw}". Expected "form", "admin", or "all" (or leave it unset).`,
  );
}

/**
 * Normalises a domain into an origin. Accepts either a bare hostname
 * (`admin.example.com`) or a full URL, since both are natural things to paste
 * into the Vercel dashboard, and strips any path so callers can concatenate.
 */
function resolveOrigin(name: string, value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    throw new Error(`Invalid ${name}: "${raw}". Expected a domain or a full https:// URL.`);
  }
}

export const APP_TARGET: AppTarget = resolveTarget();

/**
 * Origins of the two deployments. Both are optional: unset simply means the
 * cross-surface links stay relative and off-surface requests 404 instead of
 * redirecting, which is the correct behaviour before the domains exist.
 */
export const FORM_ORIGIN = resolveOrigin("FORM_ORIGIN", process.env.FORM_ORIGIN);
export const ADMIN_ORIGIN = resolveOrigin("ADMIN_ORIGIN", process.env.ADMIN_ORIGIN);

/**
 * Which surface a path belongs to. Matched on a segment boundary so a future
 * `/administrators` route is not mistaken for the dashboard.
 */
export function surfaceOf(pathname: string): "form" | "admin" {
  return pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : "form";
}

/** Absolute URL on the form domain, or the plain path when it is not configured. */
export function formUrl(path: string): string {
  return FORM_ORIGIN ? `${FORM_ORIGIN}${path}` : path;
}

/** Absolute URL on the admin domain, or the plain path when it is not configured. */
export function adminUrl(path: string): string {
  return ADMIN_ORIGIN ? `${ADMIN_ORIGIN}${path}` : path;
}

/** The origin that owns a surface, or null when that domain is not configured. */
export function originForSurface(surface: "form" | "admin"): string | null {
  return surface === "admin" ? ADMIN_ORIGIN : FORM_ORIGIN;
}
