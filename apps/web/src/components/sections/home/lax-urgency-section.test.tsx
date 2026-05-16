import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { LaxUrgencySection } from "@/components/sections/home/lax-urgency-section";
import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; sizes?: string }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function minimalLotCardVM(overrides: Partial<LotCardVM> = {}): LotCardVM {
  return {
    id: "lot-1",
    href: "/artwork/lot-1",
    lotLabel: "1",
    title: "Test lot",
    artistName: "Test Artist",
    priceLabel: "Estimate",
    priceFormatted: "$1,000",
    imageUrl: "https://example.com/a.jpg",
    imageAlt: "Test lot artwork",
    sellerId: "seller-1",
    status: "active",
    startTime: "2026-01-01T12:00:00.000Z",
    endTime: "2026-01-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("LaxUrgencySection", () => {
  const baseProps = {
    variant: "endingSoon" as const,
    items: [minimalLotCardVM(), minimalLotCardVM({ id: "lot-2", title: "Second lot" })],
    isAuthenticated: false,
    watchedLotIds: [] as const,
    loginNextPath: "/",
  };

  it("renders a 2-column grid when layoutView is grid", () => {
    const { container } = render(<LaxUrgencySection {...baseProps} layoutView="grid" />);
    const grid = container.querySelector(".grid.grid-cols-2");
    expect(grid?.className).toMatch(/grid-cols-2/);
  });

  it("renders a list when layoutView is list", () => {
    const { container } = render(<LaxUrgencySection {...baseProps} layoutView="list" />);
    const ul = container.querySelector("ul");
    expect(ul).toBeTruthy();
    expect(ul?.className).toMatch(/gap-3/);
  });

  it("maps card layout to grid for the switcher", () => {
    const { container } = render(<LaxUrgencySection {...baseProps} layoutView="card" />);
    const grid = container.querySelector(".grid.grid-cols-2");
    expect(grid?.className).toMatch(/grid-cols-2/);
  });

  it("renders Upcoming Lots heading when variant is upcoming", () => {
    render(
      <LaxUrgencySection
        {...baseProps}
        variant="upcoming"
        items={[minimalLotCardVM({ id: "sched-1", title: "Scheduled lot", status: "scheduled" })]}
        layoutView="grid"
      />,
    );
    expect(screen.getByRole("heading", { name: "Upcoming Lots" })).toBeTruthy();
  });
});
