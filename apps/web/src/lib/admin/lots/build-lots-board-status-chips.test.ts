import {
  buildLotsBoardStatusChips,
  lotsBoardQuickStatus,
} from "@/lib/admin/lots/build-lots-board-status-chips";
import { describe, expect, it } from "vitest";

describe("buildLotsBoardStatusChips", () => {
  it("maps status query to quick filter active chip", () => {
    expect(lotsBoardQuickStatus({ status: "active" })).toBe("live");
    expect(lotsBoardQuickStatus({ status: "ended" })).toBe("sold");
    expect(lotsBoardQuickStatus({ status: "cancelled" })).toBe("withdraw");
    expect(lotsBoardQuickStatus({})).toBe("all");
  });

  it("builds four quick filter chips", () => {
    const chips = buildLotsBoardStatusChips({ q: "mondrian" }, "live");
    expect(chips).toHaveLength(4);
    expect(chips.find((c) => c.id === "live")?.active).toBe(true);
    expect(chips.find((c) => c.id === "live")?.href).toContain("status=active");
    expect(chips.find((c) => c.id === "live")?.href).toContain("q=mondrian");
  });
});
