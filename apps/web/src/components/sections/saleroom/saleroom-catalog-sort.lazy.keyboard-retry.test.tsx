import { LazySaleroomCatalogSort } from "@/components/sections/saleroom/saleroom-catalog-sort.lazy";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("LazySaleroomCatalogSort when the sort could not be fetched (keyboard)", () => {
  it("can be reached by keyboard and fetches again on focus, Enter and Space", async () => {
    render(<LazySaleroomCatalogSort sortLabel="Price: high to low" />);
    await failedFetch(1);

    const standIn = screen.getByRole("button", { name: "Sort: Price: high to low" });
    expect(standIn).toHaveTextContent("Price: high to low");
    expect(standIn.tabIndex).toBe(0);

    act(() => standIn.focus());
    await failedFetch(2);

    fireEvent.keyDown(screen.getByRole("button", { name: "Sort: Price: high to low" }), {
      key: "Enter",
    });
    await failedFetch(3);

    chunk.fail = false;
    fireEvent.keyDown(screen.getByRole("button", { name: "Sort: Price: high to low" }), {
      key: " ",
    });

    // Space on the button also opens the list, so the page behind it is hidden from the tree.
    const select = await screen.findByRole("combobox", { name: "Sort lots", hidden: true });
    expect(chunk.loads).toBe(4);
    expect(select).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("button", { name: /^Sort:/ })).not.toBeInTheDocument();
  });
});
