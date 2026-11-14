import { LazySaleroomCatalogSort } from "@/components/sections/saleroom/saleroom-catalog-sort.lazy";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sales/foo/123",
  useSearchParams: () => new URLSearchParams("sort=priceDesc"),
}));

/** The sort chunk is held back until the test lets it through. */
const chunk = vi.hoisted(() => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release };
});

vi.mock("@/components/sections/saleroom/saleroom-catalog-sort", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/sections/saleroom/saleroom-catalog-sort")
  >("@/components/sections/saleroom/saleroom-catalog-sort");
  await chunk.gate;
  return actual;
});

beforeAll(() => {
  // jsdom has no layout; Radix scrolls the chosen option into view when the list opens.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
});

describe("LazySaleroomCatalogSort pressed before the select has arrived", () => {
  it("opens the list when the select arrives after a click on the button", async () => {
    render(<LazySaleroomCatalogSort sortLabel="Price: high to low" />);
    const standIn = screen.getByRole("button", { name: "Sort: Price: high to low" });
    fireEvent.click(standIn);

    await act(async () => {
      chunk.release();
    });

    const select = await screen.findByRole("combobox", { name: "Sort lots", hidden: true });
    expect(select).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("option", { name: "Price: high to low" })).toBeInTheDocument();
  });
});
