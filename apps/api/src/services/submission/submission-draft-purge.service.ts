import type { IItemSubmissionRepository } from "@auction/persistence/interfaces";
import type { IImageCleanup } from "../interfaces/image-cleanup.js";

/**
 * How long a deleted draft is kept before it is removed for good (GAP-53,
 * docs/design/decision-pack-2026-11-17.md section 5: "Soft delete with a 30-day purge so support
 * can restore").
 */
export const DELETED_DRAFT_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Drafts removed per statement, and at most this many statements a run. */
const BATCH = 200;
const MAX_BATCHES = 25;

type Log = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

export type DeletedDraftPurgeResult = {
  /** Drafts removed for good. */
  purged: number;
  /** Photos handed to image clean-up. */
  photos: number;
  /** Drafts whose photos could not be handed over (their objects stay in storage). */
  photoFailures: number;
};

/**
 * Removes drafts their clients deleted more than 30 days ago, with their documents, categories and
 * any thread (ON DELETE CASCADE), then their photos. Each photo goes to the image clean-up job,
 * which deletes the object through the storage port once nothing else refers to it: a draft
 * started from a bought lot or an earlier work shares that work's photos, which must stay. The
 * rows go first, so the job never finds a photo still held by the draft it belonged to.
 * Running it again changes nothing.
 */
export class SubmissionDraftPurgeService {
  constructor(
    private readonly submissions: Pick<IItemSubmissionRepository, "purgeDeletedDrafts">,
    private readonly photos: Pick<IImageCleanup, "enqueueRemovedMany"> | null,
    private readonly log: Log | null = null,
  ) {}

  async purgeDeletedDrafts(now: Date = new Date()): Promise<DeletedDraftPurgeResult> {
    const deletedBefore = new Date(now.getTime() - DELETED_DRAFT_RETENTION_DAYS * DAY_MS);
    const result: DeletedDraftPurgeResult = { purged: 0, photos: 0, photoFailures: 0 };
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const removed = await this.submissions.purgeDeletedDrafts(deletedBefore, BATCH);
      for (const draft of removed) {
        result.purged += 1;
        if (draft.images.length === 0 || !this.photos) continue;
        try {
          await this.photos.enqueueRemovedMany(draft.images, []);
          result.photos += draft.images.length;
        } catch (error) {
          result.photoFailures += 1;
          this.log?.warn(
            { submissionId: draft.id, error: error instanceof Error ? error.message : error },
            "purge-deleted-drafts: photos not handed to clean-up",
          );
        }
      }
      if (removed.length < BATCH) break;
    }
    this.log?.info({ ...result, deletedBefore }, "purge-deleted-drafts: done");
    return result;
  }
}
