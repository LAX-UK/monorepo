import { z } from "zod";

const shopEnvSchema = z.object({
  SHOP_API_BASE_URL: z.string().url().optional(),
  SHOP_IDENTITY_BASE_URL: z.string().url().optional(),
  /** App Platform private component URL for server-side BFF fetches (avoids ingress hairpin). */
  SHOP_IDENTITY_INTERNAL_BASE_URL: z.string().url().optional(),
  IDENTITY_PUBLIC_BASE_URL: z.string().url().optional(),
  LAX_BID_PUBLIC_URL: z.string().url().optional(),
  LAX_ART_PUBLIC_URL: z.string().url().optional(),
  WEB_ORIGIN: z.string().url().optional(),
  LAX_SHOP_STOREFRONT_URL: z.string().url().optional(),
  SHOP_STOREFRONT_URL: z.string().url().optional(),
  SHOP_IMAGE_REMOTE_HOSTS: z.string().min(1).optional(),
  /** Overrides the host rule in `shop-indexing.ts`; unset means only the launch host is indexable. */
  SHOP_ALLOW_INDEXING: z.enum(["true", "false"]).optional(),
  /** Deployment the image was built for ("test" or "prod"); hides draft policy pages on prod. */
  SHOP_DEPLOY_ENV: z.string().min(1).optional(),
});

export type ShopEnv = z.infer<typeof shopEnvSchema>;

export function loadShopEnv(
  source: Readonly<Record<string, string | undefined>> = process.env,
): ShopEnv {
  const parsed = shopEnvSchema.parse({
    SHOP_API_BASE_URL: source.SHOP_API_BASE_URL?.trim() || undefined,
    SHOP_IDENTITY_BASE_URL: source.SHOP_IDENTITY_BASE_URL?.trim() || undefined,
    SHOP_IDENTITY_INTERNAL_BASE_URL: source.SHOP_IDENTITY_INTERNAL_BASE_URL?.trim() || undefined,
    IDENTITY_PUBLIC_BASE_URL: source.IDENTITY_PUBLIC_BASE_URL?.trim() || undefined,
    LAX_BID_PUBLIC_URL: source.LAX_BID_PUBLIC_URL?.trim() || undefined,
    LAX_ART_PUBLIC_URL: source.LAX_ART_PUBLIC_URL?.trim() || undefined,
    WEB_ORIGIN: source.WEB_ORIGIN?.trim() || undefined,
    LAX_SHOP_STOREFRONT_URL: source.LAX_SHOP_STOREFRONT_URL?.trim() || undefined,
    SHOP_STOREFRONT_URL: source.SHOP_STOREFRONT_URL?.trim() || undefined,
    SHOP_IMAGE_REMOTE_HOSTS: source.SHOP_IMAGE_REMOTE_HOSTS?.trim() || undefined,
    SHOP_ALLOW_INDEXING: source.SHOP_ALLOW_INDEXING?.trim() || undefined,
    SHOP_DEPLOY_ENV: source.SHOP_DEPLOY_ENV?.trim() || undefined,
  });
  const isNextProductionBuild = source.NEXT_PHASE === "phase-production-build";
  const hasBidPublicUrl = Boolean(parsed.LAX_BID_PUBLIC_URL ?? parsed.WEB_ORIGIN);
  if (source.NODE_ENV === "production" && !hasBidPublicUrl && !isNextProductionBuild) {
    throw new Error(
      "LAX_BID_PUBLIC_URL or WEB_ORIGIN is required in production for shop cross-product links.",
    );
  }
  return parsed;
}
