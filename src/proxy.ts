import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { APP_TARGET, originForSurface, surfaceOf } from "@/lib/target";

/**
 * Two jobs, in order:
 *
 *  1. Surface routing. The form and the dashboard run as two Vercel projects
 *     on two domains off this one codebase (see src/lib/target.ts). A build
 *     answers only its own half and sends the rest to its sibling domain.
 *  2. Auth. Refreshes the Supabase session cookie and keeps signed-out
 *     visitors out of /admin. The redirect is UX only -- the real guard is RLS
 *     plus the admins-table check in the /admin layout and `requireAdmin()`.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (APP_TARGET !== "all") {
    const offSurface = handleOffSurface(request, pathname);
    if (offSurface) return offSurface;
  }

  // A form-only deployment has no admin routes and sets no auth cookies, so
  // there is nothing to refresh -- skip the Supabase round trip that would
  // otherwise sit in front of every public page load.
  if (APP_TARGET === "form") {
    return NextResponse.next({ request });
  }

  return withSession(request, pathname);
}

/**
 * Returns a response when this deployment does not own `pathname`, or null to
 * let the request through.
 *
 * Redirects are for navigations only. A POST that landed on the wrong domain
 * is a Server Action submitted against a page this build does not serve, so it
 * gets a flat 404 rather than a 307 that would replay the body somewhere else.
 */
function handleOffSurface(request: NextRequest, pathname: string) {
  // The dashboard has no landing page of its own, so the bare domain opens the
  // app instead of bouncing a signed-in admin over to the public form.
  if (APP_TARGET === "admin" && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  const surface = surfaceOf(pathname);
  if (surface === APP_TARGET) return null;

  const isNavigation = request.method === "GET" || request.method === "HEAD";
  const sibling = originForSurface(surface);

  // No sibling domain configured yet (or a non-navigation request): the route
  // simply does not exist on this deployment.
  if (!sibling || !isNavigation) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.redirect(`${sibling}${pathname}${request.nextUrl.search}`);
}

/** Session refresh plus the /admin redirect pair. */
async function withSession(request: NextRequest, pathname: string) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase; getSession() would trust
  // whatever is in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminArea = surfaceOf(pathname) === "admin";
  const isLoginPage = pathname === "/admin/login";

  if (isAdminArea && !isLoginPage && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin/applicants";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  // robots.txt and sitemap.xml are excluded deliberately: they belong to
  // whichever domain asked for them, so surface routing must not forward them.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
