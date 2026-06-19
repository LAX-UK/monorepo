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
  it("returns live-red for live and urgent tiers", () => {
    expect(liveUrgencyTextClass("live")).toContain("text-live-red");
    expect(liveUrgencyTextClass("soon")).toContain("text-live-red");
  });

  it("returns neutral text for normal tier", () => {
    expect(liveUrgencyTextClass("normal")).toContain("text-on-surface");
  });
});

describe("liveStatusCountdownClassName", () => {
  it("exports live accent typography", () => {
    expect(liveStatusCountdownClassName).toContain("text-live-red");
    expect(liveStatusCountdownClassName.length).toBeGreaterThan(0);
  });
});

describe("lotStatusToBadgeVariant", () => {
  it("maps active to live", () => expect(lotStatusToBadgeVariant("active")).toBe("live"));
  it("maps scheduled to info", () => expect(lotStatusToBadgeVariant("scheduled")).toBe("info"));
  it("maps draft to neutral", () => expect(lotStatusToBadgeVariant("draft")).toBe("neutral"));
  it("maps ended to success", () => expect(lotStatusToBadgeVariant("ended")).toBe("success"));
  it("maps cancelled to danger", () => expect(lotStatusToBadgeVariant("cancelled")).toBe("danger"));
  it("maps voided to danger", () => expect(lotStatusToBadgeVariant("voided")).toBe("danger"));
});

describe("lotEndedPresentation", () => {
  it("returns Sold when winnerId is set", () => {
    expect(lotEndedPresentation("user-1")).toEqual({
      label: "Sold",
      variant: "success",
    });
  });

  it("returns Unsold when winnerId is null", () => {
    expect(lotEndedPresentation(null)).toEqual({
      label: "Unsold",
      variant: "neutral",
    });
  });

  it("returns Ended when winnerId is omitted", () => {
    expect(lotEndedPresentation(undefined)).toEqual({
      label: "Ended",
      variant: "success",
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
