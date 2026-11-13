import { LazySaleroomCatalogSort } from "@/components/sections/saleroom/saleroom-catalog-sort.lazy";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

async function failedFetch(n: number) {
  await waitFor(() => expect(chunk.loads).toBe(n));
  await act(async () => {});
}

describe("LazySaleroomCatalogSort when the sort could not be fetched (pointer)", () => {
  it("fetches again when pointed at or pressed, without taking focus", async () => {
    render(<LazySaleroomCatalogSort sortLabel="Price: high to low" />);
    await failedFetch(1);

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Sort: Price: high to low" }));
    await failedFetch(2);

    chunk.fail = false;
    fireEvent.pointerDown(screen.getByRole("button", { name: "Sort: Price: high to low" }));

    const select = await screen.findByRole("combobox", { name: "Sort lots" });
    expect(chunk.loads).toBe(3);
    expect(select).not.toHaveFocus();
  });
});
