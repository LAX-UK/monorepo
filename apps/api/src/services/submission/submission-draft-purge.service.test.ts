import { describe, expect, it, vi } from "vitest";
import {
  DELETED_DRAFT_RETENTION_DAYS,
  SubmissionDraftPurgeService,
} from "./submission-draft-purge.service.js";

const NOW = new Date("2026-11-17T03:00:00.000Z");

describe("SubmissionDraftPurgeService (GAP-53)", () => {
  it("removes drafts deleted more than 30 days ago, then hands their photos to clean-up", async () => {
    const order: string[] = [];
    const submissions = {
      purgeDeletedDrafts: vi.fn(async () => {
        order.push("rows");
        return [
          { id: "a", images: ["submissions/a/1.jpg", "submissions/a/2.jpg"] },
          { id: "b", images: [] },
        ];
      }),
    };
    const photos = {
      enqueueRemovedMany: vi.fn(async () => {
        order.push("photos");
      }),
    };
    const result = await new SubmissionDraftPurgeService(submissions, photos).purgeDeletedDrafts(
      NOW,
    );
    expect(DELETED_DRAFT_RETENTION_DAYS).toBe(30);
    expect(submissions.purgeDeletedDrafts).toHaveBeenCalledWith(
      new Date("2026-10-18T03:00:00.000Z"),
      200,
    );
    // Every photo of the draft, none kept: the job deletes each one nothing else refers to.
    expect(photos.enqueueRemovedMany).toHaveBeenCalledTimes(1);
    expect(photos.enqueueRemovedMany).toHaveBeenCalledWith(
      ["submissions/a/1.jpg", "submissions/a/2.jpg"],
      [],
    );
    // The row goes first, so clean-up never finds the photo still held by its draft.
    expect(order).toEqual(["rows", "photos"]);
    expect(result).toEqual({ purged: 2, photos: 2, photoFailures: 0 });
  });

  it("works through a backlog a batch at a time, and stops when a batch is not full", async () => {
    const full = Array.from({ length: 200 }, (_, i) => ({ id: `d${i}`, images: [] }));
    const submissions = {
      purgeDeletedDrafts: vi
        .fn()
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce([{ id: "last", images: [] }]),
    };
    const result = await new SubmissionDraftPurgeService(submissions, null).purgeDeletedDrafts(NOW);
    expect(submissions.purgeDeletedDrafts).toHaveBeenCalledTimes(3);
    expect(result.purged).toBe(401);
  });

  it("does nothing when nothing is due", async () => {
    const submissions = { purgeDeletedDrafts: vi.fn(async () => []) };
    const photos = { enqueueRemovedMany: vi.fn() };
    expect(
      await new SubmissionDraftPurgeService(submissions, photos).purgeDeletedDrafts(NOW),
    ).toEqual({ purged: 0, photos: 0, photoFailures: 0 });
    expect(photos.enqueueRemovedMany).not.toHaveBeenCalled();
  });

  it("keeps going when one draft's photos cannot be handed over, and says so", async () => {
    const submissions = {
      purgeDeletedDrafts: vi.fn(async () => [
        { id: "a", images: ["k1"] },
        { id: "b", images: ["k2"] },
      ]),
    };
    const photos = {
      enqueueRemovedMany: vi
        .fn()
        .mockRejectedValueOnce(new Error("redis down"))
        .mockResolvedValueOnce(undefined),
    };
    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await new SubmissionDraftPurgeService(
      submissions,
      photos,
      log,
    ).purgeDeletedDrafts(NOW);
    expect(result).toEqual({ purged: 2, photos: 1, photoFailures: 1 });
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "a", imageKeys: ["k1"] }),
      expect.stringContaining("photos not handed"),
    );
  });
});
