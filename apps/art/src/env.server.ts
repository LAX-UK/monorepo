import { isArtIndexingAllowedForHost } from "@/lib/seo/art-indexing";
import { z } from "zod";

const artEnvSchema = z.object({
  SHOP_API_BASE_URL: z.string().url().optional(),
  ART_IDENTITY_BASE_URL: z.string().url().optional(),
  /** App Platform private component URL for server-side BFF fetches (avoids ingress hairpin). */
  ART_IDENTITY_INTERNAL_BASE_URL: z.string().url().optional(),
  IDENTITY_PUBLIC_BASE_URL: z.string().url().optional(),
  LAX_BID_PUBLIC_URL: z.string().url().optional(),
  WEB_ORIGIN: z.string().url().optional(),
  LAX_ART_PUBLIC_URL: z.string().url().optional(),
  LAX_SHOP_STOREFRONT_URL: z.string().url().optional(),
  SHOP_STOREFRONT_URL: z.string().url().optional(),
  SHOP_IMAGE_REMOTE_HOSTS: z.string().min(1).optional(),
  /** `true`/`false` overrides the production-host indexing gate (e.g. a pre-launch audit). */
  ART_ALLOW_INDEXING: z.enum(["true", "false"]).optional(),
  /** "test" or "prod", from the image build. On prod, draft legal notices 404 and are not linked. */
  ART_DEPLOY_ENV: z.string().min(1).optional(),
  /** GA4 web stream; loaded only after the visitor accepts analytics cookies. */
  ART_GA_MEASUREMENT_ID: z
    .string()
    .regex(/^G-[A-Z0-9]+$/)
    .optional(),
  /** Shared with shop-api; authenticates its POST /api/revalidate calls. Unset disables the endpoint. */
  ART_REVALIDATE_SECRET: z.string().min(32).optional(),
  /** Search Console HTML-tag token (DNS verification is preferred). */
  ART_GOOGLE_SITE_VERIFICATION: z.string().min(1).max(200).optional(),
});

export type ArtEnv = z.infer<typeof artEnvSchema>;

export function loadArtEnv(
  source: Readonly<Record<string, string | undefined>> = process.env,
): ArtEnv {
  const parsed = artEnvSchema.parse({
    SHOP_API_BASE_URL: source.SHOP_API_BASE_URL?.trim() || undefined,
    ART_IDENTITY_BASE_URL: source.ART_IDENTITY_BASE_URL?.trim() || undefined,
    ART_IDENTITY_INTERNAL_BASE_URL: source.ART_IDENTITY_INTERNAL_BASE_URL?.trim() || undefined,
    IDENTITY_PUBLIC_BASE_URL: source.IDENTITY_PUBLIC_BASE_URL?.trim() || undefined,
    LAX_BID_PUBLIC_URL: source.LAX_BID_PUBLIC_URL?.trim() || undefined,
    WEB_ORIGIN: source.WEB_ORIGIN?.trim() || undefined,
    LAX_ART_PUBLIC_URL: source.LAX_ART_PUBLIC_URL?.trim() || undefined,
    LAX_SHOP_STOREFRONT_URL: source.LAX_SHOP_STOREFRONT_URL?.trim() || undefined,
    SHOP_STOREFRONT_URL: source.SHOP_STOREFRONT_URL?.trim() || undefined,
    SHOP_IMAGE_REMOTE_HOSTS: source.SHOP_IMAGE_REMOTE_HOSTS?.trim() || undefined,
    ART_ALLOW_INDEXING: source.ART_ALLOW_INDEXING?.trim() || undefined,
    ART_DEPLOY_ENV: source.ART_DEPLOY_ENV?.trim() || undefined,
    ART_GA_MEASUREMENT_ID: source.ART_GA_MEASUREMENT_ID?.trim() || undefined,
    ART_GOOGLE_SITE_VERIFICATION: source.ART_GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    ART_REVALIDATE_SECRET: source.ART_REVALIDATE_SECRET?.trim() || undefined,
  });
  const isNextProductionBuild = source.NEXT_PHASE === "phase-production-build";
  const hasBidPublicUrl = Boolean(parsed.LAX_BID_PUBLIC_URL ?? parsed.WEB_ORIGIN);
  if (source.NODE_ENV === "production" && !hasBidPublicUrl && !isNextProductionBuild) {
    throw new Error(
      "LAX_BID_PUBLIC_URL or WEB_ORIGIN is required in production for lax.art cross-product links.",
    );
  }
  return parsed;
}

/** Deployment-level gate for robots.txt, the sitemap and page metadata. */
export function isArtIndexingAllowed(): boolean {
  const env = loadArtEnv();
  return isArtIndexingAllowedForHost(loadArtStorefrontBaseUrl().hostname, env.ART_ALLOW_INDEXING);
}

export function loadArtStorefrontBaseUrl(): URL {
  const env = loadArtEnv();
  const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
  const raw =
    env.LAX_ART_PUBLIC_URL ??
    (process.env.NODE_ENV === "production" && !isNextProductionBuild
      ? undefined
      : "http://localhost:3050");
  if (!raw) {
    throw new Error("LAX_ART_PUBLIC_URL is required in production.");
  }
  return new URL(raw.endsWith("/") ? raw : `${raw}/`);
}
