import { describe, expect, it } from "vitest";
import {
  type SaleFormatExplainerContext,
  resolveSaleFormatExplainer,
  saleFormatExplainerAriaLabel,
  saleFormatExplainerContextFromSale,
} from "./sale-format-explainer";

describe("resolveSaleFormatExplainer", () => {
  it("returns only online steps — no other mode titles present", () => {
    const vm = resolveSaleFormatExplainer({ deliveryMode: "online" });
    expect(vm.mode).toBe("online");
    expect(vm.title).toBe("Online Auction");
    expect(vm.steps.every((s) => s.title !== "Attend & Bid Live")).toBe(true);
    expect(vm.steps.every((s) => s.title !== "Bid Online or In-Room")).toBe(true);
  });

  it("online close step includes sale end date when provided", () => {
    const vm = resolveSaleFormatExplainer({
      deliveryMode: "online",
      saleEndTime: new Date("2026-07-15T14:00:00Z"),
    });
    const closeStep = vm.steps.find((s) => s.title === "Timed Lot Close");
    expect(closeStep).toBeDefined();
    expect(closeStep?.description).toContain("catalogue closes on");
    expect(closeStep?.description).toContain("Jul 2026");
  });

  it("online close step omits date when saleEndTime is absent", () => {
    const vm = resolveSaleFormatExplainer({ deliveryMode: "online" });
    const closeStep = vm.steps.find((s) => s.title === "Timed Lot Close");
    expect(closeStep?.description).not.toContain("catalogue closes on");
  });

  it("online never shows stream step (mode disallows stream)", () => {
    const vm = resolveSaleFormatExplainer({
      deliveryMode: "online",
      streamUrl: "https://stream.example.com/live",
    });
    expect(vm.steps.every((s) => s.title !== "Watch the Broadcast")).toBe(true);
    expect(vm.footnotes).toHaveLength(0);
  });

  it("hybrid gated copy mentions on-block when allowOnlineBidsBeforeGoLive is false", () => {
    const vm = resolveSaleFormatExplainer({
      deliveryMode: "hybrid",
      allowOnlineBidsBeforeGoLive: false,
    });
    expect(vm.description).toContain("on the block");
    const bidStep = vm.steps.find((s) => s.title === "Bid Online or In-Room");
    expect(bidStep?.description).toContain("on the block");
  });

  it("hybrid ungated copy does not mention on-block when allowOnlineBidsBeforeGoLive is true", () => {
    const vm = resolveSaleFormatExplainer({
      deliveryMode: "hybrid",
      allowOnlineBidsBeforeGoLive: true,
    });
    expect(vm.description).not.toContain("on the block");
    const bidStep = vm.steps.find((s) => s.title === "Bid Online or In-Room");
    expect(bidStep?.description).not.toContain("on the block");
  });

  it("hybrid without explicit allowOnlineBidsBeforeGoLive defaults to gated", () => {
    const vm = resolveSaleFormatExplainer({ deliveryMode: "hybrid" });
    expect(vm.description).toContain("on the block");
  });

  it("onsite shows stream step when streamUrl is set", () => {
    const vm = resolveSaleFormatExplainer({
      deliveryMode: "onsite",
      streamUrl: "https://stream.example.com",
    });
    const streamStep = vm.steps.find((s) => s.title === "Watch the Broadcast");
    expect(streamStep).toBeDefined();
    expect(streamStep?.description).toContain("live stream is available for this sale");
    expect(vm.footnotes).toHaveLength(0);
  });

  it("onsite omits stream step and adds unavailable footnote when no streamUrl", () => {
    const vm = resolveSaleFormatExplainer({ deliveryMode: "onsite" });
    expect(vm.steps.every((s) => s.title !== "Watch the Broadcast")).toBe(true);
    expect(vm.footnotes).toHaveLength(1);
    expect(vm.footnotes[0]).toContain("not listed for this sale");
  });

  it("hybrid shows stream step when streamUrl present", () => {
    const vm = resolveSaleFormatExplainer({
      deliveryMode: "hybrid",
      streamUrl: "https://stream.example.com",
      allowOnlineBidsBeforeGoLive: true,
    });
    const streamStep = vm.steps.find((s) => s.title === "Watch the Broadcast");
    expect(streamStep).toBeDefined();
    expect(vm.footnotes).toHaveLength(0);
  });

  it("hybrid without streamUrl adds unavailable footnote", () => {
    const vm = resolveSaleFormatExplainer({
      deliveryMode: "hybrid",
      allowOnlineBidsBeforeGoLive: true,
    });
    expect(vm.footnotes).toHaveLength(1);
    expect(vm.footnotes[0]).toContain("not listed for this sale");
  });

  it("online has correct iconName and colorClass", () => {
    const vm = resolveSaleFormatExplainer({ deliveryMode: "online" });
    expect(vm.iconName).toBe("Laptop");
    expect(vm.colorClass).toContain("brand");
  });

  it("onsite has MapPin iconName and amber colorClass", () => {
    const vm = resolveSaleFormatExplainer({ deliveryMode: "onsite" });
    expect(vm.iconName).toBe("MapPin");
    expect(vm.colorClass).toContain("amber");
  });
});

describe("saleFormatExplainerAriaLabel", () => {
  it("returns mode-specific label", () => {
    expect(saleFormatExplainerAriaLabel("online")).toBe("About this online auction format");
    expect(saleFormatExplainerAriaLabel("onsite")).toBe("About this in-person auction format");
    expect(saleFormatExplainerAriaLabel("hybrid")).toBe("About this hybrid auction format");
  });
});

describe("saleFormatExplainerContextFromSale", () => {
  it("maps sale fields to context shape", () => {
    const sale = {
      deliveryMode: "hybrid" as const,
      endTime: new Date("2026-07-01"),
      streamUrl: "https://stream.example.com",
      allowOnlineBidsBeforeGoLive: false,
    };
    const ctx: SaleFormatExplainerContext = saleFormatExplainerContextFromSale(sale);
    expect(ctx.deliveryMode).toBe("hybrid");
    expect(ctx.saleEndTime).toEqual(sale.endTime);
    expect(ctx.streamUrl).toBe(sale.streamUrl);
    expect(ctx.allowOnlineBidsBeforeGoLive).toBe(false);
  });
});
