import { isProductionWebHost, normalizeHostname } from "@/lib/legal-entity/org-module-enabled";
import type { Metadata } from "next";

const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;

export const X_ROBOTS_TAG_NOINDEX = "noindex, nofollow, noarchive";

function resolveAllowIndexingFromEnv(): boolean | null {
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING === "false") return false;
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true") return true;
  return null;
}

function resolveForceIndexingOverride(): boolean | null {
  if (process.env.NEXT_PUBLIC_FORCE_INDEXING === "hidden") return false;
  if (process.env.NEXT_PUBLIC_FORCE_INDEXING === "visible") return true;
  return null;
}

function hostnameFromConfiguredOrigin(): string | null {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_WEB_ORIGIN?.replace(/\/$/, "");
  if (!origin) return null;

  try {
    return normalizeHostname(new URL(origin).hostname);
  } catch {
    return null;
  }
}

function isIndexingAllowedForNormalizedHost(hostname: string): boolean {
  const force = resolveForceIndexingOverride();
  if (force !== null) return force;

  const fromEnv = resolveAllowIndexingFromEnv();
  if (fromEnv !== null) return fromEnv;

  return isProductionWebHost(hostname);
}

/** Build-time gate for robots.txt, sitemap, and static metadata. */
export function isIndexingAllowedAtBuildTime(): boolean {
  const configuredHost = hostnameFromConfiguredOrigin();
  if (configuredHost) {
    return isIndexingAllowedForNormalizedHost(configuredHost);
  }

  return false;
}

/** Request-time gate for middleware and per-request metadata. */
export function isIndexingAllowedForHost(hostname: string): boolean {
  return isIndexingAllowedForNormalizedHost(normalizeHostname(hostname));
}

export function noindexRobotsMetadata() {
  return NOINDEX_ROBOTS;
}

/** Apply global noindex policy when the deployment is not production-indexable. */
export function withIndexingPolicy(metadata: Metadata): Metadata {
  if (isIndexingAllowedAtBuildTime()) return metadata;
  return { ...metadata, robots: NOINDEX_ROBOTS };
}
