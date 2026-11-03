import type { WorkerEnv } from "../env.js";
import type { S3ArchiveStoreConfig } from "./archive-store.js";

export type SubjectExportConfig = {
  identityBaseUrl: string;
  bidBaseUrl: string;
  shopBaseUrl: string;
  /** Identity: OAuth client credentials for the `subject_export` scope. */
  identityClient: { id: string; secret: string };
  /** Bid and Shop: the export client pair, sent with the scope header. */
  productClient: { id: string; secret: string };
  bucket: S3ArchiveStoreConfig;
};

/**
 * The settings for "Download my data", or null when none are set. The environment schema makes
 * them all-or-nothing, so a partly set deployment never starts; with none set the feature is off,
 * requests wait in the queue and nothing is collected.
 */
export function subjectExportConfigFromEnv(env: WorkerEnv): SubjectExportConfig | null {
  const {
    IDENTITY_INTERNAL_BASE_URL: identityBaseUrl,
    SHOP_API_INTERNAL_BASE_URL: shopBaseUrl,
    SUBJECT_EXPORT_MACHINE_CLIENT_ID: identityClientId,
    SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: identityClientSecret,
    IDENTITY_SUBJECT_EXPORT_CLIENT_ID: productClientId,
    IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET: productClientSecret,
    SUBJECT_EXPORT_BUCKET: bucket,
    SUBJECT_EXPORT_REGION: region,
    SUBJECT_EXPORT_WRITE_ACCESS_KEY_ID: accessKeyId,
    SUBJECT_EXPORT_WRITE_SECRET_ACCESS_KEY: secretAccessKey,
  } = env;
  if (
    !identityBaseUrl ||
    !shopBaseUrl ||
    !identityClientId ||
    !identityClientSecret ||
    !productClientId ||
    !productClientSecret ||
    !bucket ||
    !region ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    return null;
  }
  return {
    identityBaseUrl,
    bidBaseUrl: env.API_INTERNAL_BASE_URL,
    shopBaseUrl,
    identityClient: { id: identityClientId, secret: identityClientSecret },
    productClient: { id: productClientId, secret: productClientSecret },
    bucket: {
      bucket,
      region,
      endpoint: env.SUBJECT_EXPORT_ENDPOINT,
      accessKeyId,
      secretAccessKey,
    },
  };
}
