import { describe, expect, it } from "vitest";
import {
  getSaleModeCapabilities,
  isSaleroomDeliveryMode,
  isSaleroomGatedForOnlineBids,
  saleModeAllowsBidding,
  saleModeAllowsOperatorBidding,
  saleModeBidChannels,
  saleModeInheritsLotTiming,
} from "./sale-mode-policy.js";

describe("sale-mode-policy", () => {
  it("allows web bidding for online and hybrid", () => {
    expect(saleModeAllowsBidding("online")).toBe(true);
    expect(saleModeAllowsBidding("hybrid")).toBe(true);
    expect(saleModeAllowsBidding("onsite")).toBe(false);
  });

  it("allows operator bidding for onsite and hybrid", () => {
    expect(saleModeAllowsOperatorBidding("online")).toBe(true);
    expect(saleModeAllowsOperatorBidding("hybrid")).toBe(true);
    expect(saleModeAllowsOperatorBidding("onsite")).toBe(true);
  });

  it("hybrid inherits lot timing and saleroom capabilities", () => {
    const hybrid = getSaleModeCapabilities("hybrid");
    expect(hybrid.inheritsLotTiming).toBe(true);
    expect(hybrid.allowsStreamUrl).toBe(true);
    expect(hybrid.allowsLocation).toBe(true);
    expect(saleModeInheritsLotTiming("hybrid")).toBe(true);
    expect(isSaleroomDeliveryMode("hybrid")).toBe(true);
  });

  it("online does not inherit lot timing or saleroom delivery", () => {
    const online = getSaleModeCapabilities("online");
    expect(online.allowsStreamUrl).toBe(false);
    expect(saleModeInheritsLotTiming("online")).toBe(false);
    expect(isSaleroomDeliveryMode("online")).toBe(false);
  });

  it("gates hybrid online bids by default and allows opt-out", () => {
    expect(
      isSaleroomGatedForOnlineBids({ deliveryMode: "hybrid", allowOnlineBidsBeforeGoLive: false }),
    ).toBe(true);
    expect(
      isSaleroomGatedForOnlineBids({ deliveryMode: "hybrid", allowOnlineBidsBeforeGoLive: true }),
    ).toBe(false);
    expect(isSaleroomGatedForOnlineBids({ deliveryMode: "online" })).toBe(false);
  });

  it("exposes bid channel visibility per delivery mode", () => {
    expect(saleModeBidChannels("online")).toEqual({ online: true, room: false, phone: false });
    expect(saleModeBidChannels("onsite")).toEqual({ online: false, room: true, phone: true });
    expect(saleModeBidChannels("hybrid")).toEqual({ online: true, room: true, phone: true });
    expect(getSaleModeCapabilities("online").bidChannels.online).toBe(true);
  });
});
