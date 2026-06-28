import { PressPageToolbar } from "@/components/sections/press/press-page-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/press",
  useSearchParams: () => new URLSearchParams(),
}));

const baseProps = {
  params: { q: "", year: null, page: 1 },
  resultCount: 12,
  years: [2026, 2025, 2024],
};

describe("PressPageToolbar", () => {
  it("renders mobile filter trigger and RSS link", () => {
    render(<PressPageToolbar {...baseProps} />);

    expect(screen.getAllByRole("button", { name: /Filters/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /RSS/i })).toHaveAttribute("href", "/press/feed.xml");
    expect(screen.getByText("12 articles")).toBeInTheDocument();
  });

  it("shows filter badge and active chips when facets are set", () => {
    render(
      <PressPageToolbar {...baseProps} params={{ q: "Evening Standard", year: 2025, page: 1 }} />,
    );

    expect(
      screen.getAllByRole("button", { name: /Filters.*2 active filters/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("Evening Standard");
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("2025");
  });

  it("does not render active filters when no facets are set", () => {
    render(<PressPageToolbar {...baseProps} />);
    expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
  });
});
