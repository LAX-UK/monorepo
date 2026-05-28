import { ArtistFollowListToolbar } from "@/components/dashboard/artist-follow/artist-follow-list-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/artist-follow",
  useSearchParams: () => new URLSearchParams(),
}));

describe("ArtistFollowListToolbar", () => {
  it("shows filter badge when sort is non-default and hides desktop sort on mobile layout", () => {
    render(
      <ArtistFollowListToolbar
        filters={{
          q: "",
          sort: "nameAsc",
        }}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Filters, 1 applied/i })).toHaveLength(2);

    const sortComboboxes = screen.getAllByRole("combobox", { name: "Sort" });
    expect(sortComboboxes).toHaveLength(1);
    expect(sortComboboxes[0]?.closest(".lg\\:block")).toBeTruthy();
  });
});
