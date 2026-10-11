import type { ShopApiEnv } from "../env.js";
import type { ShopDocumentStorageConfig } from "./shop-document-download-url.js";

export function resolveShopDocumentStorageConfig(
  env: Pick<
    ShopApiEnv,
    "S3_BUCKET" | "S3_REGION" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY" | "S3_ENDPOINT"
  >,
): ShopDocumentStorageConfig | null {
  if (
    !env.S3_BUCKET?.trim() ||
    !env.S3_REGION?.trim() ||
    !env.S3_ACCESS_KEY_ID?.trim() ||
    !env.S3_SECRET_ACCESS_KEY?.trim()
  ) {
    return null;
  }
  return {
    bucket: env.S3_BUCKET.trim(),
    region: env.S3_REGION.trim(),
    accessKeyId: env.S3_ACCESS_KEY_ID.trim(),
    secretAccessKey: env.S3_SECRET_ACCESS_KEY.trim(),
    ...(env.S3_ENDPOINT?.trim() ? { endpoint: env.S3_ENDPOINT.trim() } : {}),
  };
}
