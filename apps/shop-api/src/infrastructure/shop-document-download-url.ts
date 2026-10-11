import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ShopDocumentStorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
};

let cachedClient: S3Client | null = null;
let cachedConfigKey: string | null = null;

function configKey(config: ShopDocumentStorageConfig): string {
  return `${config.bucket}:${config.region}:${config.endpoint ?? ""}`;
}

function getClient(config: ShopDocumentStorageConfig): S3Client {
  const key = configKey(config);
  if (cachedClient && cachedConfigKey === key) {
    return cachedClient;
  }
  cachedClient = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  });
  cachedConfigKey = key;
  return cachedClient;
}

/** Returns a short-lived GET URL when object storage is configured; otherwise null. */
export async function createShopDocumentDownloadUrl(
  config: ShopDocumentStorageConfig | null,
  objectKey: string,
  expiresInSec = 900,
): Promise<string | null> {
  if (!config || !objectKey.trim()) return null;
  const client = getClient(config);
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: objectKey.trim() });
  return getSignedUrl(client, command, { expiresIn: expiresInSec });
}
