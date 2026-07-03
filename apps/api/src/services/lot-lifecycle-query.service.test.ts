import { describe, expect, it, vi } from "vitest";
import type { ILotLifecycleTimelineReader } from "../repositories/interfaces/lot-lifecycle-timeline.reader.js";
import { LotLifecycleQueryService } from "./lot-lifecycle-query.service.js";

describe("LotLifecycleQueryService.timeline", () => {
  it("returns the newest events in chronological order", async () => {
    const timelineReader: ILotLifecycleTimelineReader = {
      fetchTimelineEvents: vi.fn().mockResolvedValue([
        {
          id: 3,
          occurredAt: new Date("2024-12-01T00:00:00.000Z"),
          eventType: "lot.ended",
          payload: {},
          actorUserId: null,
        },
        {
          id: 2,
          occurredAt: new Date("2024-06-01T00:00:00.000Z"),
          eventType: "lot.published",
          payload: {},
          actorUserId: null,
        },
      ]),
      fetchSaleTitlesByIds: vi.fn(),
    };

    const svc = new LotLifecycleQueryService(
      { getSnapshot: vi.fn(), getSnapshotsForLots: vi.fn() },
      timelineReader,
    );

    const timeline = await svc.timeline("lot-1", { limit: 2 });

    expect(timeline).toHaveLength(2);
    expect(timeline.map((e) => e.eventType)).toEqual(["lot.published", "lot.ended"]);
  });
});
