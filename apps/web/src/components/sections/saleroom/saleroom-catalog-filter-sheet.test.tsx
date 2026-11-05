import { SaleroomCatalogFilterSheet } from "@/components/sections/saleroom/saleroom-catalog-filter-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));

function open(counts: { live: number; upcoming: number; ended: number } | null) {
  render(
    <SaleroomCatalogFilterSheet
      basePath="/sales/foo/123"
      resultCountLabel="Show 5 lots"
      statusCounts={counts}
    />,
  );
  fireEvent.click(screen.getAllByRole("button", { name: /Filters/i })[0] as HTMLElement);
}

describe("SaleroomCatalogFilterSheet", () => {
  beforeEach(() => {
    push.mockClear();
    search = "";
  });

  it("offers each lot status as a checkbox that reads its count", () => {
    open({ live: 2, upcoming: 3, ended: 0 });
    expect(screen.getByRole("checkbox", { name: "Live , 2" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Upcoming , 3" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Ended , 0" })).toBeDisabled();
  });

  it("applies a status and keeps the other parameters", () => {
    search = "q=vase";
    open({ live: 2, upcoming: 3, ended: 1 });
    fireEvent.click(screen.getByRole("checkbox", { name: "Live , 2" }));
    expect(push).toHaveBeenCalledWith("/sales/foo/123?q=vase&status=live", { scroll: false });
  });

  it("takes the applied status off", () => {
    search = "status=live";
    open({ live: 2, upcoming: 3, ended: 1 });
    expect(screen.getByRole("checkbox", { name: "Live , 2" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Live , 2" }));
    expect(push).toHaveBeenCalledWith("/sales/foo/123", { scroll: false });
  });

  it("shows no counts when they could not be made", () => {
    open(null);
    expect(screen.getByRole("checkbox", { name: "Live" })).toBeEnabled();
  });
});
