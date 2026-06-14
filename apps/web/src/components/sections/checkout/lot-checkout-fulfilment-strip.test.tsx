import { LotCheckoutFulfilmentStrip } from "@/components/sections/checkout/lot-checkout-fulfilment-strip";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("LotCheckoutFulfilmentStrip", () => {
  it("retains SSR snapshot when polling fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    render(
      <LotCheckoutFulfilmentStrip
        lotId="00000000-0000-4000-8000-000000000001"
        fulfilment={{
          id: "00000000-0000-4000-8000-000000000002",
          lotId: "00000000-0000-4000-8000-000000000001",
          paymentId: "00000000-0000-4000-8000-000000000003",
          status: "awaiting_release",
          fulfilmentMethod: null,
          shippingCarrier: null,
          trackingNumber: null,
          collectedBy: null,
          collectedAt: null,
        }}
      />,
    );
    expect(screen.getByText(/paid — awaiting release/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
