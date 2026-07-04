import { describe, expect, it, vi } from "vitest";
import type { IClearArtistBlocksRepository } from "../interfaces/clear-artist-blocks.repository.js";
import { applyClearArtistBlocksEvent } from "./clear-artist-blocks.js";

describe("applyClearArtistBlocksEvent", () => {
  it("clears lots on artist.reviewed + approved", async () => {
    const repo: IClearArtistBlocksRepository = {
      getArtistStatus: vi.fn(),
      clearLotsArtistReviewRequired: vi.fn().mockResolvedValue(undefined),
    };

    await applyClearArtistBlocksEvent(repo, {
      id: 1,
      eventType: "artist.reviewed",
      aggregateId: "artist-1",
      payload: { decision: "approved" },
    });

    expect(repo.clearLotsArtistReviewRequired).toHaveBeenCalledWith("artist-1");
  });

  it("skips artist.reviewed when not approved", async () => {
    const repo: IClearArtistBlocksRepository = {
      getArtistStatus: vi.fn(),
      clearLotsArtistReviewRequired: vi.fn(),
    };
    await applyClearArtistBlocksEvent(repo, {
      id: 1,
      eventType: "artist.reviewed",
      aggregateId: "artist-1",
      payload: { decision: "rejected" },
    });
    expect(repo.clearLotsArtistReviewRequired).not.toHaveBeenCalled();
  });

  it("clears lots on artist.merged when canonical is approved", async () => {
    const repo: IClearArtistBlocksRepository = {
      getArtistStatus: vi.fn().mockResolvedValue("approved"),
      clearLotsArtistReviewRequired: vi.fn().mockResolvedValue(undefined),
    };

    await applyClearArtistBlocksEvent(repo, {
      id: 1,
      eventType: "artist.merged",
      aggregateId: "artist-old",
      payload: { intoArtistId: "artist-new" },
    });

    expect(repo.getArtistStatus).toHaveBeenCalledWith("artist-new");
    expect(repo.clearLotsArtistReviewRequired).toHaveBeenCalledWith("artist-new");
  });
});
