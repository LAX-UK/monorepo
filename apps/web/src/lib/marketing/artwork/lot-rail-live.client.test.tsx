import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSaleCatalogueLive = vi.fn();
vi.mock("@/lib/marketing/saleroom/sale-catalogue-live.client", () => ({
  fetchSaleCatalogueLive: (...args: unknown[]) => fetchSaleCatalogueLive(...args),
}));

import { useLotRailLive } from "./lot-rail-live.client";

let client: QueryClient;
const card = (id: string, saleId: string | null) => ({ id, saleId, href: "/", title: id }) as never;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useLotRailLive (CO-7)", () => {
  beforeEach(() => {
    fetchSaleCatalogueLive.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("reads each sale once, no-store via the sale catalogue read, and merges the lots", async () => {
    fetchSaleCatalogueLive.mockImplementation(async (...a: unknown[]) => {
      const input = a[0] as { saleId: string };
      return new Map([[`lot-in-${input.saleId}`, { status: "active" }]]);
    });
    const rail = {
      mode: "seller",
      heading: "More from this seller",
      viewAuctionHref: null,
      premiumSale: null,
      cards: [card("a", "s1"), card("b", "s1"), card("c", "s2"), card("d", null)],
    } as never;

    const { result } = renderHook(() => useLotRailLive(rail), { wrapper });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current?.size).toBe(2));
    expect(fetchSaleCatalogueLive).toHaveBeenCalledTimes(2);
    expect([...(result.current?.keys() ?? [])].sort()).toEqual(["lot-in-s1", "lot-in-s2"]);
  });

  it("reads nothing for a rail with no sale", () => {
    const rail = { cards: [card("a", null)], premiumSale: null } as never;
    renderHook(() => useLotRailLive(rail), { wrapper });
    expect(fetchSaleCatalogueLive).not.toHaveBeenCalled();
  });
});
