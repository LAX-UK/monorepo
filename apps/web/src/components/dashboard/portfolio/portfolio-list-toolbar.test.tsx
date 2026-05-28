import { PortfolioListToolbar } from "@/components/dashboard/portfolio/portfolio-list-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/portfolio",
  useSearchParams: () => new URLSearchParams(),
}));

describe("PortfolioListToolbar", () => {
  it("shows filter badge count on mobile trigger", () => {
    render(
      <PortfolioListToolbar
        filters={{
          payment: "all",
          q: "",
          year: 2024,
        }}
        years={[2024, 2023]}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Filters, 1 applied/i })).toHaveLength(2);
  });
});
