import type { MetadataRoute } from "next";

/** Private, auth and thin search-result routes stay out of the index. */
export const ART_ROBOTS_DISALLOW = [
  "/account",
  "/preview",
  "/search",
  "/login",
  "/register",
  "/session-expired",
  "/sign-in-error",
  "/signed-out",
] as const;

export function composeArtRobots(baseUrl: URL, indexingAllowed: boolean): MetadataRoute.Robots {
  if (!indexingAllowed) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...ART_ROBOTS_DISALLOW] },
    sitemap: [
      new URL("/sitemap.xml", baseUrl).toString(),
      new URL("/legacy-sitemap.xml", baseUrl).toString(),
    ],
    host: baseUrl.origin,
  };
}
