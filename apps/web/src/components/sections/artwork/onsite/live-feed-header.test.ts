import { describe, expect, it } from "vitest";
import { getLiveFeedHeaderMeta } from "./live-feed-header";

describe("getLiveFeedHeaderMeta", () => {
  it("shows Live now when live without watcher count", () => {
    const m = getLiveFeedHeaderMeta("live");
    expect(m.title).toBe("Live Feed");
    expect(m.statusLabel).toBe("Live now");
    expect(m.pulse).toBe(true);
    expect(m.tone).toBe("live");
  });

  it("shows live tone for hybrid saleroom session", () => {
    const m = getLiveFeedHeaderMeta("liveSaleroom");
    expect(m.title).toBe("Live Feed");
    expect(m.statusLabel).toBe("Live now");
    expect(m.pulse).toBe(true);
    expect(m.tone).toBe("live");
  });

  it("shows watching count when live with watchers", () => {
    const m = getLiveFeedHeaderMeta("extended", { watcherCount: 1200 });
    expect(m.statusLabel).toBe("1k watching");
    expect(m.pulse).toBe(false);
  });

  it("shows opens countdown for scheduled", () => {
    const m = getLiveFeedHeaderMeta("scheduled", { countdownClock: "01:23:45" });
    expect(m.title).toBe("Bid Activity");
    expect(m.statusLabel).toBe("Opens in 01:23:45");
    expect(m.tone).toBe("upcoming");
  });

  it("shows bidding closed for ended", () => {
    expect(getLiveFeedHeaderMeta("endedSold").statusLabel).toBe("Bidding closed");
    expect(getLiveFeedHeaderMeta("cancelled").tone).toBe("ended");
  });
});
