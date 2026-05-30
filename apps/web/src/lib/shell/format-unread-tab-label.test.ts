import { describe, expect, it } from "vitest";
import { formatUnreadTabLabel } from "./format-unread-tab-label";

describe("formatUnreadTabLabel", () => {
  it("returns label when unread is zero", () => {
    expect(formatUnreadTabLabel("Notifications", 0)).toBe("Notifications");
  });

  it("includes count for single unread", () => {
    expect(formatUnreadTabLabel("Notifications", 1)).toBe("Notifications, 1 unread notification");
  });

  it("caps display at 9+", () => {
    expect(formatUnreadTabLabel("Notifications", 12)).toBe(
      "Notifications, 9+ unread notifications",
    );
  });
});
