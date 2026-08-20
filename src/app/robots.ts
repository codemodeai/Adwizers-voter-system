import type { MetadataRoute } from "next";

import { APP_TARGET, FORM_ORIGIN } from "@/lib/target";

/**
 * The dashboard domain is closed to crawlers outright. The form domain invites
 * them in, minus the /admin paths -- which that deployment redirects away
 * anyway, but saying so keeps the two domains from competing for the same URLs
 * in search results.
 *
 * Rendered per request rather than prerendered: APP_TARGET is read from the
 * environment, and a statically baked robots.txt would keep serving whichever
 * target happened to be set at build time -- which is how an admin deployment
 * ends up publishing "Allow: /". robots.txt is hit rarely enough that the cost
 * of rendering it live is irrelevant.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (APP_TARGET === "admin") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/register/thank-you"] },
    ...(FORM_ORIGIN ? { host: FORM_ORIGIN } : {}),
  };
}
