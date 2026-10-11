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
