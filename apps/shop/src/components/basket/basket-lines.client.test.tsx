/** @vitest-environment jsdom */
import { BasketLinesClient } from "@/components/basket/basket-lines.client";
import type { BasketLine } from "@auction/shop-contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/app/actions/basket.actions", () => ({
  addArtworkToBasket: vi.fn(),
  addMerchandiseVariantToBasket: vi.fn(),
  removeBasketLine: vi.fn(),
  setBasketLineQuantity: vi.fn(),
  setMerchandiseBasketLineQuantity: vi.fn(),
}));

const line: BasketLine = {
  lineId: "00000000-0000-4000-8000-000000000001",
  artworkSlug: "warm-basket",
  artworkTitle: "Warm Basket",
  productVariantId: null,
  productSlug: null,
  productTitle: null,
  variantSku: null,
  unitPricePence: 12000,
  quantity: 1,
  soldOut: false,
  priceChanged: false,
  outOfStock: false,
  imageUrl: "/warm.webp",
  artistName: "Emmett King",
  artistSlug: "emmett-king",
  editionSize: 24,
  editionLine: "Limited edition of 24 · Hand-signed",
  orderLimit: 2,
  maxQuantity: 2,
};

function show(lines: BasketLine[]) {
  return render(
    <BasketLinesClient
      lines={lines}
      summaryActions={<a href="/checkout">Checkout</a>}
      emptyState={<p>Your basket is empty</p>}
    />,
  );
}

describe("BasketLinesClient", () => {
  afterEach(cleanup);

  it("shows the order summary beside the lines, with the total saying VAT is included", () => {
    show([line]);
    const summary = screen.getByRole("complementary");
    expect(within(summary).getByText("Total, including VAT")).toBeTruthy();
    expect(within(summary).queryByText(/^Prices include VAT/)).toBeNull();
    expect(within(summary).getByRole("link", { name: "Checkout" })).toBeTruthy();
  });

  it("dims a sold-out line and says it sold out while in the basket, with Remove and Get alerts", () => {
    const { container } = show([{ ...line, soldOut: true, outOfStock: true }]);
    const row = container.querySelector("li.shop-basket__line");
    expect(row?.classList.contains("shop-basket__line--sold-out")).toBe(true);
    expect(screen.getByText("This edition sold out while it was in your basket.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Warm Basket" })).toBeTruthy();
    const alerts = screen.getByRole("link", { name: "Get alerts" });
    expect(alerts.getAttribute("href")).toBe("/artworks/warm-basket");
    // A sold-out line cannot be bought more of.
    expect(screen.queryByRole("group", { name: /quantity/i })).toBeNull();
  });

  it("leaves an available line undimmed", () => {
    const { container } = show([line]);
    expect(container.querySelector(".shop-basket__line--sold-out")).toBeNull();
    expect(screen.queryByRole("link", { name: "Get alerts" })).toBeNull();
  });

  it("says when only the quantity is short, and offers no Get alerts", () => {
    show([{ ...line, outOfStock: true }]);
    expect(screen.getByText("Quantity not available")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Get alerts" })).toBeNull();
  });

  it("shows the empty state when nothing is left", () => {
    show([]);
    expect(screen.getByText("Your basket is empty")).toBeTruthy();
  });
});
