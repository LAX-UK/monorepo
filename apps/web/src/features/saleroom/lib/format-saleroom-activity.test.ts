import {
  formatSaleroomEventKind,
  mergeActivityLog,
} from "@/features/saleroom/lib/format-saleroom-activity";
import { describe, expect, it } from "vitest";

describe("format-saleroom-activity", () => {
  it("maps known event kinds to readable labels", () => {
    expect(formatSaleroomEventKind("opened")).toBe("Session went live");
    expect(formatSaleroomEventKind("advanced_to_lot")).toBe("Lot advanced to block");
  });

  it("merges socket and db events with dedupe", () => {
    const merged = mergeActivityLog(
      [
        {
          kind: "opened",
          saleId: "s1",
          emittedAt: "2026-06-16T10:00:00.000Z",
        },
      ],
      [
        {
          id: "e1",
          sessionId: "sess-1",
          kind: "opened",
          occurredAt: "2026-06-16T10:00:00.000Z",
          payload: {},
          actorUserId: "user-1",
        },
      ],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.label).toBe("Session went live");
  });
});
