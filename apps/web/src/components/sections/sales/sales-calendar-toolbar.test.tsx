import { SalesCalendarToolbar } from "@/components/sections/sales/sales-calendar-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sales",
  useSearchParams: () => new URLSearchParams(),
}));

const baseState = {
  tab: "upcoming" as const,
  deliveryMode: "all" as const,
  location: "all" as const,
  sort: "startAsc" as const,
  view: "grid" as const,
};

const baseProps = {
  state: baseState,
  resultCount: 12,
  categories: [{ id: "cat-1", name: "Modern Art" }],
  years: [2026, 2025],
  calendarView: "grid" as const,
};

describe("SalesCalendarToolbar", () => {
  it("renders mobile filter trigger and view switcher on one row", () => {
    render(<SalesCalendarToolbar {...baseProps} />);

    expect(screen.getAllByRole("button", { name: /Filters/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-trailing-row")).not.toBeInTheDocument();
    expect(screen.queryByText("Filters (1)")).not.toBeInTheDocument();
  });

  it("shows filter badge and active chips when facets are set", () => {
    render(
      <SalesCalendarToolbar
        {...baseProps}
        state={{ ...baseState, deliveryMode: "online", location: "london" }}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /Filters.*2 active filters/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("Online");
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("London");
  });

  it("does not render active filters when no facets are set", () => {
    render(<SalesCalendarToolbar {...baseProps} />);
    expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
  });
});
