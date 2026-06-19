import { describe, expect, it } from "vitest";
import { lotStatusBadgeProps } from "./lot-status-badge-props";

describe("lotStatusBadgeProps", () => {
  it("passes winnerId from catalog lot VM", () => {
    expect(
      lotStatusBadgeProps({
        status: "ended",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2026-01-02T00:00:00.000Z",
        winnerId: "user-1",
      }),
    ).toEqual({
      status: "ended",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
      winnerId: "user-1",
    });
  });

  it("omits winnerId when not on source", () => {
    const props = lotStatusBadgeProps({
      status: "active",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
    });
    expect(props.winnerId).toBeUndefined();
  });
});
