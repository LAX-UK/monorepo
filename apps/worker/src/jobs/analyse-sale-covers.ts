import {
  assembleCoverAnalysis,
  breakpointsMeasuredForSlot,
  effectiveCoverSide,
} from "@auction/domain";
import type { CoverImageAnalyser } from "@auction/image-processing";
import type pino from "pino";
import type {
  ICoverAnalysisJobRepository,
  PendingCoverSlot,
} from "../interfaces/cover-analysis-job.repository.js";
import { normalizeCatalogueKey } from "../lib/catalogue-image-keys.js";
import type { UploadStorage } from "../lib/upload-storage.js";

/** How many cover slots one run measures; the next run takes the rest. */
export const COVER_ANALYSIS_BATCH = 10;

type Dependencies = {
  repo: ICoverAnalysisJobRepository;
  storage: UploadStorage;
  analyser: CoverImageAnalyser;
  log: pino.Logger;
  /** Public address of the media bucket; a slot holding a full address under it is read by its storage key. */
  publicBaseUrl?: string;
};

/**
 * Measures one slot's picture and stores the result under the slot's fingerprint. A picture that
 * is missing or cannot be decoded is recorded as failed, so it is not tried again until staff
 * change the slot; a storage error is thrown so the job tries again.
 */
export async function analyseCoverSlot(
  deps: Dependencies,
  pending: PendingCoverSlot,
): Promise<"ready" | "failed"> {
  const { slot, name } = pending;
  const key =
    normalizeCatalogueKey(slot.fromLot?.imageKey ?? slot.key ?? "", deps.publicBaseUrl) ?? "";
  const head = key ? await deps.storage.headObject(key) : null;
  const bytes =
    head && head.byteSize > 0 ? await deps.storage.getObjectBytes(key, head.byteSize) : null;
  if (!bytes || bytes.byteLength === 0) {
    deps.log.warn(
      { saleId: pending.saleId, slot: name, key, slotKey: slot.fromLot?.imageKey ?? slot.key },
      "cover analysis: picture missing in storage",
    );
    await deps.repo.save(slot.analysisHash, { status: "failed" });
    return "failed";
  }

  const side = effectiveCoverSide(slot);
  try {
    const measurements = await deps.analyser.measure({
      bytes,
      preCrop: slot.fromLot?.crop,
      focal: slot.focal,
      zoom: slot.zoom,
      textSide: side,
      breakpoints: breakpointsMeasuredForSlot(name),
    });
    await deps.repo.save(slot.analysisHash, {
      status: "ready",
      analysis: assembleCoverAnalysis(measurements, side),
    });
    return "ready";
  } catch (error) {
    deps.log.warn(
      { saleId: pending.saleId, slot: name, key, err: error },
      "cover analysis: picture could not be read",
    );
    await deps.repo.save(slot.analysisHash, { status: "failed" });
    return "failed";
  }
}

/** Measures the cover slots staff have set or changed since they were last measured. */
export async function analyseSaleCoversJob(
  deps: Dependencies,
  limit = COVER_ANALYSIS_BATCH,
): Promise<{ ready: number; failed: number }> {
  const pending = await deps.repo.listPending(limit);
  let ready = 0;
  let failed = 0;
  for (const item of pending) {
    if ((await analyseCoverSlot(deps, item)) === "ready") ready += 1;
    else failed += 1;
  }
  if (pending.length > 0) deps.log.info({ ready, failed }, "cover analysis completed");
  return { ready, failed };
}
