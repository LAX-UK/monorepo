/** @vitest-environment jsdom */
import BasketPage from "@/app/basket/page";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/shop-viewer-state.server", () => ({
  loadShopViewerState: async () => ({ kind: "guest" }),
}));
vi.mock("@/lib/shop-commerce.server", () => ({
  fetchShopBasket: async () => ({ status: "empty" }),
  listShopOrders: async () => ({ status: "empty" }),
}));
vi.mock("@/lib/shop-api.server", () => ({
  fetchPublicArtworks: async () => ({ items: [] }),
}));
vi.mock("@/components/basket/basket-lines.client", () => ({
  BasketLinesClient: ({ emptyState }: { emptyState: ReactNode }) => <>{emptyState}</>,
}));
vi.mock("@/components/basket/shop-basket-cancel-notice.client", () => ({
  ShopBasketCancelNotice: () => null,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/basket",
  useRouter: () => ({ refresh: () => {}, replace: () => {}, push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("basket page, empty", () => {
  afterEach(cleanup);

  it("keeps the page's one h1 and puts the empty state under it as an h2", async () => {
    render(await BasketPage());
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.textContent).toContain("Basket");
    expect(screen.getByRole("heading", { level: 2, name: "Your basket is empty" })).toBeTruthy();
    expect(document.querySelector("[data-layout='page']")).not.toBeNull();
  });
});
