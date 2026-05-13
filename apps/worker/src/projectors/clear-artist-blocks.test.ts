import { describe, expect, it, vi } from "vitest";
import { applyClearArtistBlocksEvent } from "./clear-artist-blocks.js";

describe("applyClearArtistBlocksEvent", () => {
  it("clears lots on artist.reviewed + approved", async () => {
    const update = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = {
      update: vi.fn(() => ({ set: update })),
    } as unknown as import("@auction/db").Database;

    await applyClearArtistBlocksEvent(db, {
      id: 1,
      eventType: "artist.reviewed",
      aggregateId: "artist-1",
      payload: { decision: "approved" },
    });

    expect(db.update).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ artistReviewRequired: false });
  });

  it("skips artist.reviewed when not approved", async () => {
    const db = { update: vi.fn() } as unknown as import("@auction/db").Database;
    await applyClearArtistBlocksEvent(db, {
      id: 1,
      eventType: "artist.reviewed",
      aggregateId: "artist-1",
      payload: { decision: "rejected" },
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("clears lots on artist.merged when canonical is approved", async () => {
    const update = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: "approved" }]),
          }),
        }),
      }),
      update: vi.fn(() => ({ set: update })),
    } as unknown as import("@auction/db").Database;

    await applyClearArtistBlocksEvent(db, {
      id: 2,
      eventType: "artist.merged",
      aggregateId: "from-artist",
      payload: { intoArtistId: "into-1" },
    });

    expect(db.update).toHaveBeenCalled();
  });

  it("does not clear on artist.merged when canonical is pending", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: "pending" }]),
          }),
        }),
      }),
      update: vi.fn(),
    } as unknown as import("@auction/db").Database;

    await applyClearArtistBlocksEvent(db, {
      id: 2,
      eventType: "artist.merged",
      aggregateId: "from-artist",
      payload: { intoArtistId: "into-1" },
    });

    expect(db.update).not.toHaveBeenCalled();
  });
});
