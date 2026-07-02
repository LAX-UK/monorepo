import { SaleroomHeroEditorial } from "@/components/sections/saleroom/hero/saleroom-hero-editorial";
import { saleroomHeroFixture } from "@/components/sections/saleroom/saleroom-hero.fixture";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/time/use-client-clock", () => ({
  useClientClock: vi.fn(() => Date.parse("2026-06-12T12:00:00.000Z")),
}));

beforeEach(() => {
  // Pin wall clock so the server-side `resolveHeroCountdownEnd` (which reads
  // `new Date()`) sees the same "during sale" instant as the mocked client clock.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-12T12:00:00.000Z"));
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SaleroomHeroEditorial", () => {
  it("renders editorial hero structure with heading and stats", () => {
    render(
      <SaleroomHeroEditorial
        hero={{
          ...saleroomHeroFixture,
          status: "scheduled",
          isLive: false,
          startTime: "2026-06-12T12:00:00.000Z",
          endTime: "2026-06-14T18:00:00.000Z",
          leftColumnLabel: "Preview opens",
          registrationClosesShort: "10 days",
          rightColumnLabel: "Bidding starts",
          biddingStartsShort: "148 days",
        }}
        toolbar={<nav aria-label="Sale actions">Toolbar</nav>}
        actions={<div>Actions</div>}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Modern British Art" }),
    ).toBeInTheDocument();
    const schedule = screen.getByRole("group", { name: /sale schedule/i });
    expect(within(schedule).getByText("10 days")).toBeInTheDocument();
    expect(within(schedule).getByText("148 days")).toBeInTheDocument();
    expect(within(schedule).getByText("Bidding starts:")).toBeInTheDocument();
    expect(screen.getByText("Total Lots")).toBeInTheDocument();
    expect(screen.getByText("120 lots")).toBeInTheDocument();
    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
    expect(screen.queryByText("Format")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /sale actions/i })).toBeInTheDocument();
  });

  it("omits duplicate Bidding Live now for active sales but keeps segmented Closes in countdown", () => {
    render(
      <SaleroomHeroEditorial
        hero={{
          ...saleroomHeroFixture,
          biddingStartsShort: null,
          rightColumnLabel: null,
        }}
        toolbar={null}
        actions={null}
      />,
    );

    const schedule = screen.getByRole("group", { name: /sale schedule/i });
    expect(within(schedule).queryByText("Live now")).not.toBeInTheDocument();
    expect(within(schedule).queryByText(/Bidding:/)).not.toBeInTheDocument();
    expect(within(schedule).getByText("Closes in")).toBeInTheDocument();
    expect(within(schedule).getByText("Hours")).toBeInTheDocument();
    expect(within(schedule).getByText("Min")).toBeInTheDocument();
    expect(within(schedule).getByText("Sec")).toBeInTheDocument();
    expect(within(schedule).getByText(/Ends ·/i)).toBeInTheDocument();
  });

  it("pluralises live lot count in the meta row", () => {
    render(
      <SaleroomHeroEditorial
        hero={{ ...saleroomHeroFixture, liveLotsCount: 1 }}
        toolbar={null}
        actions={null}
      />,
    );
    expect(screen.getByText(/1 lot live/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 lots live/i)).not.toBeInTheDocument();
  });

  it("uses meaningful cover alt text", () => {
    render(<SaleroomHeroEditorial hero={saleroomHeroFixture} toolbar={null} actions={null} />);
    expect(screen.getByRole("img", { name: "Cover for Modern British Art" })).toBeInTheDocument();
  });

  it("applies font-semibold to the sale H1", () => {
    render(<SaleroomHeroEditorial hero={saleroomHeroFixture} toolbar={null} actions={null} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("font-semibold");
  });

  it("shows Est. Total stat when estimatedTotalLabel is present", () => {
    render(
      <SaleroomHeroEditorial
        hero={{ ...saleroomHeroFixture, estimatedTotalLabel: "£1.2M" }}
        toolbar={null}
        actions={null}
      />,
    );
    expect(screen.getByText("Est. Total")).toBeInTheDocument();
    expect(screen.getByText("£1.2M")).toBeInTheDocument();
  });
});
