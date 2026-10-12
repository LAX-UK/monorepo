import { type ObjectStoragePort, S3ObjectStorage } from "@auction/object-storage";
import type { ShopApiEnv } from "../env.js";

export type ShopMediaStorageConfig = {
  storage: ObjectStoragePort;
  publicBaseUrl: string;
};

export function resolveShopMediaStorage(
  env: Pick<
    ShopApiEnv,
    | "S3_BUCKET"
    | "S3_REGION"
    | "S3_ENDPOINT"
    | "S3_ACCESS_KEY_ID"
    | "S3_SECRET_ACCESS_KEY"
    | "SHOP_MEDIA_PUBLIC_BASE_URL"
  >,
): ShopMediaStorageConfig | null {
  if (
    !env.S3_BUCKET?.trim() ||
    !env.S3_REGION?.trim() ||
    !env.S3_ACCESS_KEY_ID?.trim() ||
    !env.S3_SECRET_ACCESS_KEY?.trim()
  ) {
    return null;
  }
  const publicBaseUrl = env.SHOP_MEDIA_PUBLIC_BASE_URL?.trim();
  if (!publicBaseUrl) {
    return null;
  }
  const storage = new S3ObjectStorage({
    bucket: env.S3_BUCKET.trim(),
    region: env.S3_REGION.trim(),
    accessKeyId: env.S3_ACCESS_KEY_ID.trim(),
    secretAccessKey: env.S3_SECRET_ACCESS_KEY.trim(),
    publicBaseUrl,
    ...(env.S3_ENDPOINT?.trim() ? { endpoint: env.S3_ENDPOINT.trim() } : {}),
  });
  return { storage, publicBaseUrl: publicBaseUrl.replace(/\/$/, "") };
}
