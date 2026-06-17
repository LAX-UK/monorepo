import { ArchivePageToolbar } from "@/components/sections/archive/archive-page-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/archive",
  useSearchParams: () => new URLSearchParams(),
}));

const baseQuery = {
  endYear: undefined,
  categoryId: undefined,
  sortMode: "hammer" as const,
};

const baseProps = {
  query: baseQuery,
  resultCount: 24,
  categories: [{ id: "cat-1", name: "Painting" }],
  layoutView: "grid" as const,
};

describe("ArchivePageToolbar", () => {
  it("renders mobile filter trigger and view switcher on one row", () => {
    render(<ArchivePageToolbar {...baseProps} />);

    expect(screen.getAllByRole("button", { name: /Filters/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-trailing-row")).not.toBeInTheDocument();
  });

  it("shows filter badge and active chips when facets are set", () => {
    render(
      <ArchivePageToolbar
        {...baseProps}
        query={{ endYear: 2024, categoryId: "cat-1", sortMode: "recent" }}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /Filters.*3 active filters/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("2024");
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("Painting");
  });

  it("does not render active filters when no facets are set", () => {
    render(<ArchivePageToolbar {...baseProps} />);
    expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
  });

  it("keeps desktop filter rows inside sticky and active chips below it", () => {
    const { container } = render(
      <ArchivePageToolbar
        {...baseProps}
        query={{ endYear: 2024, categoryId: "cat-1", sortMode: "recent" }}
      />,
    );

    const sticky = container.querySelector(".sticky");
    expect(sticky).not.toBeNull();
    expect(sticky).not.toContainElement(screen.getByLabelText("Active filters"));
    expect(sticky).toContainElement(screen.getByLabelText("Lot year"));
    expect(sticky).toContainElement(screen.getByLabelText("Medium"));
    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
  });
});
