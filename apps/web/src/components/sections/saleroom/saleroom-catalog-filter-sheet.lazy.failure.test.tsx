import { LazySaleroomCatalogFilterSheet } from "@/components/sections/saleroom/saleroom-catalog-filter-sheet.lazy";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sales/foo/123",
  useSearchParams: () => new URLSearchParams(),
}));

const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));

vi.mock("@/components/sections/saleroom/saleroom-catalog-filter-sheet", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/sections/saleroom/saleroom-catalog-filter-sheet")
  >("@/components/sections/saleroom/saleroom-catalog-filter-sheet");
  return {
    get SaleroomCatalogFilterSheet() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("chunk failed");
      return actual.SaleroomCatalogFilterSheet;
    },
  };
});

describe("LazySaleroomCatalogFilterSheet when the sheet could not be fetched", () => {
  it("keeps the trigger, fetches again when it is pressed and opens the sheet", async () => {
    render(
      <LazySaleroomCatalogFilterSheet
        basePath="/sales/foo/123"
        resultCountLabel="Show 24 lots"
        statusCounts={null}
      />,
    );
    await waitFor(() => expect(chunk.loads).toBe(1));
    await act(async () => {});
    const trigger = screen.getByRole("button", { name: /Filters/i });
    expect(trigger).not.toHaveAttribute("aria-expanded");

    chunk.fail = false;
    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    expect(chunk.loads).toBe(2);
  });
});
