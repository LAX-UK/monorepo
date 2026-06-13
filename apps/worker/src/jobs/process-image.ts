import type { Database } from "@auction/db";
import { mediaAsset } from "@auction/db";
import type pino from "pino";
import type { ImageProcessor } from "../lib/image-processor.js";
import type { UploadStorage } from "../lib/upload-storage.js";

export async function processImageJob(args: {
  db: Database;
  storage: UploadStorage;
  processor: ImageProcessor;
  key: string;
  log: pino.Logger;
}): Promise<void> {
  const key = args.key.trim().replace(/^\/+/, "");
  if (!key) return;

  const head = await args.storage.headObject(key);
  if (!head || head.byteSize <= 0) {
    args.log.warn({ key }, "process-image skipped: object missing");
    return;
  }

  const buffer = await args.storage.getObjectBytes(key, head.byteSize);
  if (!buffer || buffer.byteLength === 0) {
    args.log.warn({ key }, "process-image skipped: empty object");
    return;
  }

  const { width, height } = await args.processor.analyze(buffer);
  const blurDataURL = await args.processor.makeLqip(buffer);

  await args.db
    .insert(mediaAsset)
    .values({ key, width, height, blurDataURL })
    .onConflictDoUpdate({
      target: mediaAsset.key,
      set: {
        width,
        height,
        blurDataURL,
        processedAt: new Date(),
      },
    });

  args.log.info({ key, width, height }, "media asset processed");
}
