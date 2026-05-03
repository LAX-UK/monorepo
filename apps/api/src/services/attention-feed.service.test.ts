import { describe, expect, it } from "vitest";
import { composeAttentionItems } from "./attention-feed.service.js";

describe("composeAttentionItems", () => {
  it("combines admin attention sources and filters only stale payments / past draft lots", () => {
    const now = new Date("2026-05-03T00:00:00.000Z");

    const items = composeAttentionItems({
      now,
      limit: 10,
      submissions: [
        {
          id: "sub-1",
          title: "Pair of Regency chairs",
          status: "under_review",
          createdAt: new Date("2026-05-02T12:00:00.000Z"),
        },
      ],
      payments: [
        {
          id: "pay-fresh-0000",
          status: "pending",
          createdAt: new Date("2026-05-02T12:00:00.000Z"),
        },
        {
          id: "pay-stale-0000",
          status: "authorized",
          createdAt: new Date("2026-04-30T12:00:00.000Z"),
        },
      ],
      draftLots: [
        {
          id: "lot-past",
          title: "Untitled study",
          startTime: new Date("2026-05-02T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
        },
        {
          id: "lot-future",
          title: "Future draft",
          startTime: new Date("2026-05-04T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ],
    });

    expect(items.map((item) => item.id)).toEqual([
      "sub-sub-1",
      "draft-lot-past",
      "pay-pay-stale-0000",
    ]);
    expect(items.map((item) => item.kind)).toEqual([
      "submission_under_review",
      "lot_draft_past_start",
      "payment_stale",
    ]);
  });
});
