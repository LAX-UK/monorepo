/** @vitest-environment jsdom */
import { buildShopOrderDetailVm } from "@/lib/account/shop-orders.vm";
import type { OrderSummary } from "@auction/shop-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopOrderDetail } from "./shop-order-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/account/orders/o",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const NOW = new Date("2026-11-20T09:10:00.000Z");
const ORDER_ID = "00000000-0000-4000-8000-000000000001";

/** A paid order, refunded, as the Shop API returns it. Fixture data only. */
const refunded: OrderSummary = {
  orderId: ORDER_ID,
  reference: "LAX-S-10001",
  status: "refunded",
  fulfilment: "uk_insured_delivery",
  merchandiseSubtotalPence: 8500,
  fulfilmentSurchargePence: 1500,
  totalPence: 10000,
  lines: [
    {
      orderLineId: ORDER_ID,
      artworkSlug: "harbor-print",
      artworkTitle: "Harbor Print",
      artistName: "Juno Frost",
      productVariantId: null,
      productSlug: null,
      productTitle: null,
      variantSku: null,
      editionNumber: 7,
      editionSize: 24,
      unitPricePence: 8500,
      imageUrl: "https://cdn.example/harbor.webp",
    },
  ],
  createdAt: "2026-11-12T14:01:00.000Z",
  paidAt: "2026-11-12T14:05:00.000Z",
  deliveryAddress: {
    recipientName: "Robert Thorne",
    line1: "12 Elm Row",
    city: "Edinburgh",
    postcode: "EH7 4AA",
    country: "GB",
  },
  vatIncludedPence: 1667,
  vatRateBp: 2000,
  progress: null,
  refunds: [],
  problemReport: { open: false, endsAt: null },
  invoiceAvailable: true,
};

const issued = (refund: string | null) =>
  ({
    kind: "issued",
    title: "Invoice LAX-INV-000124",
    meta: "Issued Thu 12 Nov, 14:05 GMT",
    refund,
    delivery: null,
    download: { label: "Download invoice (PDF)", href: `/account/orders/${ORDER_ID}/documents/d` },
  }) as const;

describe("ShopOrderDetail, help with this order", () => {
  it("after a refund names LAX's own document 'Order receipt (PDF)', beside Books' invoice", () => {
    const order = buildShopOrderDetailVm(refunded, NOW);
    render(
      <ShopOrderDetail order={order} invoiceCard={issued("A refund was made on Mon 16 Nov.")} />,
    );
    expect(screen.getByRole("link", { name: "Download invoice (PDF)" }).getAttribute("href")).toBe(
      `/account/orders/${ORDER_ID}/documents/d`,
    );
    const receipt = screen.getByRole("link", { name: "Order receipt (PDF)" });
    expect(receipt.getAttribute("href")).toBe(order.invoiceHref);
    expect(screen.getAllByRole("link", { name: "Download invoice (PDF)" })).toHaveLength(1);
  });

  it("while LAX's own invoice is the only one, keeps 'Download invoice (PDF)' under Help", () => {
    const order = buildShopOrderDetailVm(refunded, NOW);
    render(<ShopOrderDetail order={order} invoiceCard={{ kind: "lax" }} />);
    expect(screen.getByRole("link", { name: "Download invoice (PDF)" }).getAttribute("href")).toBe(
      order.invoiceHref,
    );
    expect(screen.queryByRole("link", { name: "Order receipt (PDF)" })).toBeNull();
  });
});
