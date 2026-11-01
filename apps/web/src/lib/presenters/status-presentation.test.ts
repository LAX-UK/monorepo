import { lotStatuses, saleStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  liveStatusCountdownClassName,
  liveUrgencyTextClass,
  lotEndedPresentation,
  lotStatusLabel,
  lotStatusToBadgeVariant,
  resolveLotStatusPresentation,
  resolveStatusPresentation,
  saleStatusLabel,
  saleStatusToBadgeVariant,
} from "./status-presentation";

describe("liveUrgencyTextClass", () => {
  it("keeps a live or calm countdown in calm ink", () => {
    expect(liveUrgencyTextClass("live")).toBe("text-countdown-calm");
    expect(liveUrgencyTextClass("normal")).toBe("text-countdown-calm");
  });

  it("warns in the final hour and is urgent in the final minutes", () => {
    expect(liveUrgencyTextClass("soon")).toBe("text-countdown-soon");
    expect(liveUrgencyTextClass("imminent")).toBe("text-countdown-final");
  });
});

describe("liveStatusCountdownClassName", () => {
  it("is calm, tabular and at least 12px", () => {
    expect(liveStatusCountdownClassName).toContain("text-countdown-calm");
    expect(liveStatusCountdownClassName).toContain("tabular-nums");
    expect(liveStatusCountdownClassName).toContain("text-xs");
  });
});

describe("lotStatusToBadgeVariant", () => {
  it("maps active to live", () => expect(lotStatusToBadgeVariant("active")).toBe("live"));
  it("maps scheduled to info", () => expect(lotStatusToBadgeVariant("scheduled")).toBe("info"));
  it("maps draft to info", () => expect(lotStatusToBadgeVariant("draft")).toBe("info"));
  it("maps ended to neutral", () => expect(lotStatusToBadgeVariant("ended")).toBe("neutral"));
  it("maps cancelled to danger", () => expect(lotStatusToBadgeVariant("cancelled")).toBe("danger"));
  it("maps voided to danger", () => expect(lotStatusToBadgeVariant("voided")).toBe("danger"));
});

describe("lotEndedPresentation", () => {
  it("returns Sold when winnerId is set", () => {
    expect(lotEndedPresentation({ winnerId: "user-1" })).toEqual({
      label: "Sold",
      variant: "success",
    });
  });

  it("returns Sold when hasWinner is true without buyer id", () => {
    expect(lotEndedPresentation({ hasWinner: true })).toEqual({
      label: "Sold",
      variant: "success",
    });
  });

  it("returns Unsold when winnerId is null", () => {
    expect(lotEndedPresentation({ winnerId: null })).toEqual({
      label: "Unsold",
      variant: "neutral",
    });
  });

  it("returns Unsold when hasWinner is false", () => {
    expect(lotEndedPresentation({ hasWinner: false })).toEqual({
      label: "Unsold",
      variant: "neutral",
    });
  });

  it("returns Ended when outcome is omitted", () => {
    expect(lotEndedPresentation(undefined)).toEqual({
      label: "Ended",
      variant: "neutral",
    });
  });
});

describe("resolveLotStatusPresentation", () => {
  it("maps active with dot", () => {
    expect(resolveLotStatusPresentation("active")).toEqual({
      label: "Live",
      variant: "live",
      dot: true,
    });
  });

  it("maps ended with hasWinner to Sold", () => {
    expect(resolveLotStatusPresentation("ended", { hasWinner: true })).toEqual({
      label: "Sold",
      variant: "success",
    });
  });

  it("maps ended with winner to Sold", () => {
    expect(resolveLotStatusPresentation("ended", { winnerId: "w-1" })).toEqual({
      label: "Sold",
      variant: "success",
    });
  });

  it("maps ended without winner to Unsold", () => {
    expect(resolveLotStatusPresentation("ended", { winnerId: null })).toEqual({
      label: "Unsold",
      variant: "neutral",
    });
  });
});

describe("resolveStatusPresentation", () => {
  it("resolves sale active as live with dot", () => {
    expect(resolveStatusPresentation("sale", "active")).toEqual({
      label: "Live",
      variant: "live",
      dot: true,
    });
  });

  it("resolves payout paid as success", () => {
    expect(resolveStatusPresentation("payout", "paid")).toEqual({
      label: "Paid",
      variant: "success",
      dot: false,
    });
  });
});

describe("status label coverage", () => {
  it("lotStatusLabel covers all lot statuses", () => {
    for (const status of lotStatuses) {
      expect(lotStatusLabel[status]).toBeTruthy();
      expect(lotStatusToBadgeVariant(status)).toBeTruthy();
    }
  });

  it("saleStatusLabel covers all sale statuses", () => {
    for (const status of saleStatuses) {
      expect(saleStatusLabel[status]).toBeTruthy();
      expect(saleStatusToBadgeVariant(status)).toBeTruthy();
    }
  });
});
