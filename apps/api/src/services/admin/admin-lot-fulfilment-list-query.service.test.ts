import { describe, expect, it, vi } from "vitest";
import { AdminLotFulfilmentListQueryService } from "./admin-lot-fulfilment-list-query.service.js";

const row = (lotId: string) => ({ lotId, status: "released" }) as never;

describe("the lot fulfilment queue's Collection read", () => {
  it("adds the live visit to each row with one read for the page", async () => {
    const findLiveByLots = vi.fn(
      async () =>
        new Map([
          [
            "lot-a",
            {
              slotStart: new Date("2026-11-12T14:00:00.000Z"),
              slotEnd: new Date("2026-11-12T14:30:00.000Z"),
              reference: "COL-1042",
            },
          ],
        ]) as never,
    );
    const service = new AdminLotFulfilmentListQueryService(
      {
        listForAdmin: vi.fn(async () => ({ items: [row("lot-a"), row("lot-b")] })),
        countMatching: vi.fn(async () => 2),
        summarizeForAdmin: vi.fn(async () => ({ total: 2 })),
      } as never,
      { findLiveByLots },
    );
    const page = await service.getPage({ limit: 50, offset: 0 });
    expect(findLiveByLots).toHaveBeenCalledTimes(1);
    expect(findLiveByLots).toHaveBeenCalledWith(["lot-a", "lot-b"]);
    expect(page.rows[0]).toMatchObject({
      lotId: "lot-a",
      collectionVisit: {
        start: "2026-11-12T14:00:00.000Z",
        end: "2026-11-12T14:30:00.000Z",
      },
    });
    expect(page.rows[1]).toMatchObject({ lotId: "lot-b", collectionVisit: null });
  });
});
