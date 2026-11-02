import type pino from "pino";
import type { IMediaAssetProcessorRepository } from "../interfaces/media-asset-processor.repository.js";
import type { ExternalPictureDeps } from "../lib/external-picture.js";
import { fetchExternalPicture } from "../lib/external-picture.js";
import type { ImageProcessor } from "../lib/image-processor.js";

/** How many pictures one run reads; the next run takes the rest. */
export const EXTERNAL_PICTURE_BATCH = 10;

type Dependencies = {
  repo: IMediaAssetProcessorRepository;
  processor: ImageProcessor;
  log: pino.Logger;
  /** Addresses that could not be read; kept by the caller so a bad address is not retried each run. */
  failed: Set<string>;
  fetching?: ExternalPictureDeps;
};

/**
 * Stores the size and blur preview of lot photographs held as full https addresses (seeded or
 * imported rather than uploaded), under the address itself. Uploaded pictures are measured by the
 * process-image job; this closes the gap for pictures that never pass through an upload.
 */
export async function measureExternalPicturesJob(
  deps: Dependencies,
  limit = EXTERNAL_PICTURE_BATCH,
): Promise<{ measured: number; failed: number }> {
  const urls = await deps.repo.listUnmeasuredExternalLotPictures(limit, [...deps.failed]);
  let measured = 0;
  let failed = 0;
  for (const url of urls) {
    try {
      const bytes = await fetchExternalPicture(url, deps.fetching);
      const { width, height } = await deps.processor.analyze(bytes);
      const blurDataURL = await deps.processor.makeLqip(bytes);
      await deps.repo.upsertProcessed({ key: url, width, height, blurDataURL });
      measured += 1;
    } catch (error) {
      deps.failed.add(url);
      failed += 1;
      deps.log.warn({ url, err: error }, "external picture could not be measured");
    }
  }
  if (urls.length > 0) deps.log.info({ measured, failed }, "external pictures measured");
  return { measured, failed };
}
