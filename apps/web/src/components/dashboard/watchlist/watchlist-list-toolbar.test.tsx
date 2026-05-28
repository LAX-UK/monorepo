import { WatchlistListToolbar } from "@/components/dashboard/watchlist/watchlist-list-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/watchlist",
  useSearchParams: () => new URLSearchParams(),
}));

describe("WatchlistListToolbar", () => {
  it("shows filter badge count and hides desktop sort on mobile layout", () => {
    render(
      <WatchlistListToolbar
        filters={{
          sort: "addedDesc",
          status: "active",
          categoryIds: ["cat-1"],
          q: "",
        }}
        categories={[{ id: "cat-1", name: "Paintings" }]}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Filters, 2 applied/i })).toHaveLength(2);

    const sortComboboxes = screen.getAllByRole("combobox", { name: "Sort" });
    expect(sortComboboxes).toHaveLength(1);
    expect(sortComboboxes[0]?.closest(".lg\\:block")).toBeTruthy();
  });
});
