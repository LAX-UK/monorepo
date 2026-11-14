import { LazySaleroomCatalogSort } from "@/components/sections/saleroom/saleroom-catalog-sort.lazy";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sales/foo/123",
  useSearchParams: () => new URLSearchParams("sort=priceDesc"),
}));

/** The sort chunk: refused while `fail` is set; `loads` counts fetches. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));

vi.mock("@/components/sections/saleroom/saleroom-catalog-sort", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/sections/saleroom/saleroom-catalog-sort")
  >("@/components/sections/saleroom/saleroom-catalog-sort");
  return {
    get SaleroomCatalogSort() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("chunk failed");
      return actual.SaleroomCatalogSort;
    },
  };
});

beforeAll(() => {
  // jsdom has no layout; Radix scrolls the chosen option into view when the list opens.
  Element.prototype.scrollIntoView = vi.fn();
});

/** Waits until fetch number `n` has failed and the stand-in is shown again. */
async function failedFetch(n: number) {
  await waitFor(() => expect(chunk.loads).toBe(n));
  await act(async () => {});
}

describe("LazySaleroomCatalogSort when a retry started by focus succeeds", () => {
  it("hands focus to the select", async () => {
    render(<LazySaleroomCatalogSort sortLabel="Price: high to low" />);
    await failedFetch(1);

    chunk.fail = false;
    act(() => screen.getByRole("button", { name: "Sort: Price: high to low" }).focus());

    const select = await screen.findByRole("combobox", { name: "Sort lots" });
    expect(select).toHaveFocus();
  });
});
