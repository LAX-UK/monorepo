import { LazySaleroomCatalogFilterSheet } from "@/components/sections/saleroom/saleroom-catalog-filter-sheet.lazy";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sales/foo/123",
  useSearchParams: () => searchParams,
}));

/** The sheet's chunk: held back until `arrive()`, and refused while `fail` is set. */
const chunk = vi.hoisted(() => {
  let arrive: () => void = () => {};
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  return { arrived, arrive: () => arrive(), fail: false };
});

vi.mock("@/components/sections/saleroom/saleroom-catalog-filter-sheet", async () => {
  await chunk.arrived;
  const actual = await vi.importActual<
    typeof import("@/components/sections/saleroom/saleroom-catalog-filter-sheet")
  >("@/components/sections/saleroom/saleroom-catalog-filter-sheet");
  return {
    get SaleroomCatalogFilterSheet() {
      if (chunk.fail) throw new Error("chunk failed");
      return actual.SaleroomCatalogFilterSheet;
    },
  };
});

afterEach(cleanup);

const props = {
  basePath: "/sales/foo/123",
  resultCountLabel: "Show 24 lots",
  statusCounts: null,
};

// The tests share the module cache and run in order: before the chunk arrives, after it arrives.
describe("LazySaleroomCatalogFilterSheet", () => {
  it("shows the trigger with the active filter badge before the sheet arrives", () => {
    searchParams = new URLSearchParams("status=live");
    render(<LazySaleroomCatalogFilterSheet {...props} />);
    expect(screen.getByRole("button", { name: /Filters.*1 active filters/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the sheet once it arrives when the trigger was pressed before", async () => {
    searchParams = new URLSearchParams();
    render(<LazySaleroomCatalogFilterSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Filters/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      chunk.arrive();
    });

    expect(await screen.findByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });

  it("draws the real trigger on its first render once the sheet has arrived (client navigation)", () => {
    searchParams = new URLSearchParams("status=live");
    render(<LazySaleroomCatalogFilterSheet {...props} />);
    // No waiting: the stand-in has no `aria-expanded`, the sheet's own triggers (phone and wide) have.
    const triggers = screen.getAllByRole("button", { name: /Filters.*1 active filters/i });
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
