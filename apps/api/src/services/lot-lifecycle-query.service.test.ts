import type { Database } from "@auction/db";
import { describe, expect, it } from "vitest";
import { LotLifecycleQueryService } from "./lot-lifecycle-query.service.js";

function mockTimelineDb(rows: Array<{ id: number; occurredAt: Date; eventType: string }>) {
  const descRows = [...rows].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id - a.id,
  );
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            offset: () => ({
              limit: (n: number) => Promise.resolve(descRows.slice(0, n)),
            }),
          }),
        }),
      }),
    }),
  } as unknown as Database;
}

describe("LotLifecycleQueryService.timeline", () => {
  it("returns the newest events in chronological order", async () => {
    const svc = new LotLifecycleQueryService(
      mockTimelineDb([
        {
          id: 1,
          occurredAt: new Date("2024-01-01T00:00:00.000Z"),
          eventType: "lot.created",
        },
        {
          id: 2,
          occurredAt: new Date("2024-06-01T00:00:00.000Z"),
          eventType: "lot.published",
        },
        {
          id: 3,
          occurredAt: new Date("2024-12-01T00:00:00.000Z"),
          eventType: "lot.ended",
        },
      ]),
    );

    const timeline = await svc.timeline("lot-1", { limit: 2 });

    expect(timeline).toHaveLength(2);
    expect(timeline.map((e) => e.eventType)).toEqual(["lot.published", "lot.ended"]);
  });
});
