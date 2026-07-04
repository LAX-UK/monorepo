import type pino from "pino";
import type { IMediaAssetCleanupRepository } from "../interfaces/media-asset-cleanup.repository.js";
import type { UploadStorage } from "../lib/upload-storage.js";

export async function cleanupImageJob(args: {
  mediaAssetCleanupRepo: IMediaAssetCleanupRepository;
  storage: UploadStorage;
  key: string;
  publicBaseUrl?: string | undefined;
  log: pino.Logger;
}): Promise<void> {
  const key = args.key.trim().replace(/^\/+/, "");
  if (!key) return;

  const referenceValues = buildReferenceValues(key, args.publicBaseUrl);
  if (await args.mediaAssetCleanupRepo.isKeyReferenced(referenceValues)) {
    args.log.info({ key }, "skipped image cleanup because key is still referenced");
    return;
  }

  const variants = await args.mediaAssetCleanupRepo.getVariants(key);
  if (variants) {
    for (const variantKey of Object.values(variants)) {
      if (typeof variantKey === "string" && variantKey && variantKey !== key) {
        await args.storage.deleteObject(variantKey).catch(() => undefined);
      }
    }
  }

  await args.mediaAssetCleanupRepo.deleteByKey(key);
  await args.storage.deleteObject(key);
  args.log.info({ key }, "deleted unreferenced image object");
}

function buildReferenceValues(key: string, publicBaseUrl: string | undefined): string[] {
  const values = [key];
  if (publicBaseUrl) {
    values.push(`${publicBaseUrl.replace(/\/$/, "")}/${key}`);
  }
  return values;
}
