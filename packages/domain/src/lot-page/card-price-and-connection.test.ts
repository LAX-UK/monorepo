import { describe, expect, it } from "vitest";
import { cardPriceLine } from "./card-price-line.js";
import {
  CONNECTION_NOTICES,
  CONNECTION_NOTICE_AFTER_MS,
  CONNECTION_PAUSED_AFTER_MS,
  CONNECTION_RESTORED_FOR_MS,
  connectionNoticeFor,
} from "./connection-notice.js";
import { LOT_LIFECYCLE_KINDS } from "./lifecycle-copy.js";
import { buildPriceBlock } from "./price-block.js";
import { NO_VIEWER_STATE } from "./viewer-state.js";

const format = { money: (a: string) => `£${Number(a).toLocaleString("en-GB")}` };
const amounts = {
  starting: "4200.00",
  current: "7000.00",
  hammer: "7000.00",
  soldForWithPremium: "8750.00",
};

describe("cardPriceLine", () => {
  it("says what the lot page says for every lifecycle", () => {
    for (const lifecycle of LOT_LIFECYCLE_KINDS) {
      const card = cardPriceLine({
        lifecycle,
        bidCount: 6,
        amounts,
        estimate: { low: "6000", high: "9000" },
        format,
      });
      const page = buildPriceBlock({
        lifecycle,
        amounts,
        estimate: { low: "6000", high: "9000" },
        bidCount: 6,
        reserve: "none",
        nextBid: null,
        extendedByMs: null,
        saleroom: null,
        signedIn: false,
        registrationRequired: false,
        viewer: NO_VIEWER_STATE,
        purchase: null,
        agentLimitLeft: null,
        format,
      });
      if (page.amountText === null || lifecycle === "endedNoSale") continue;
      expect([lifecycle, card.label, card.value]).toEqual([lifecycle, page.label, page.amountText]);
    }
  });

  it("reports the premium-inclusive price of a sold lot and a closing clock for a live one", () => {
    const sold = cardPriceLine({
      lifecycle: "endedSold",
      bidCount: 6,
      amounts,
      estimate: null,
      format,
    });
    expect(sold).toEqual({ label: "Sold for", value: "£8,750", time: "ended" });
    const live = cardPriceLine({ lifecycle: "live", bidCount: 0, amounts, estimate: null, format });
    expect(live).toEqual({ label: "Starting bid", value: "£4,200", time: "closes" });
  });

  it("says an unsold lot did not sell, since the card shows its estimate elsewhere", () => {
    const line = cardPriceLine({
      lifecycle: "endedNoSale",
      bidCount: 3,
      amounts,
      estimate: { low: "6000", high: "9000" },
      format,
    });
    expect(line).toEqual({ label: "Not sold", value: null, time: "ended" });
  });

  it("has no figure when a lot was withdrawn", () => {
    const line = cardPriceLine({
      lifecycle: "withdrawn",
      bidCount: 0,
      amounts,
      estimate: null,
      format,
    });
    expect(line).toEqual({ label: "Withdrawn", value: null, time: "none" });
  });
});

describe("connectionNoticeFor", () => {
  const live = { state: "live", troubledForMs: 0, noticeWasShown: false, restoredForMs: null };

  it("says nothing while the connection is healthy", () => {
    expect(connectionNoticeFor({ ...live })).toBeNull();
  });

  it("waits for the loss to last before it speaks", () => {
    const lost = { ...live, state: "offline" as const };
    expect(
      connectionNoticeFor({ ...lost, troubledForMs: CONNECTION_NOTICE_AFTER_MS - 1 }),
    ).toBeNull();
    expect(connectionNoticeFor({ ...lost, troubledForMs: CONNECTION_NOTICE_AFTER_MS })).toBe(
      "reconnecting",
    );
  });

  it("says updates are paused once the loss lasts", () => {
    expect(
      connectionNoticeFor({
        ...live,
        state: "connecting",
        troubledForMs: CONNECTION_PAUSED_AFTER_MS,
      }),
    ).toBe("paused");
  });

  it("calls a slow connection slow, never paused", () => {
    expect(
      connectionNoticeFor({
        ...live,
        state: "degraded",
        troubledForMs: CONNECTION_PAUSED_AFTER_MS,
      }),
    ).toBe("slow");
  });

  it("confirms recovery briefly, and only after a notice was shown", () => {
    const back = { ...live, noticeWasShown: true };
    expect(connectionNoticeFor({ ...back, restoredForMs: 0 })).toBe("restored");
    expect(connectionNoticeFor({ ...back, restoredForMs: CONNECTION_RESTORED_FOR_MS })).toBeNull();
    expect(connectionNoticeFor({ ...live, restoredForMs: 0 })).toBeNull();
  });

  it("only the paused notice offers a refresh", () => {
    expect(
      Object.entries(CONNECTION_NOTICES)
        .filter(([, copy]) => copy.offersRefresh)
        .map(([kind]) => kind),
    ).toEqual(["paused"]);
  });
});
