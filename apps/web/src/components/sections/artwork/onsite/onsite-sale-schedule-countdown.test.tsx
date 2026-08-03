import { OnsiteSaleScheduleCountdown } from "@/components/sections/artwork/onsite/onsite-sale-schedule-countdown";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/time/use-client-clock", () => ({
  useClientClock: vi.fn(),
}));

import { useClientClock } from "@/lib/time/use-client-clock";

const baseNow = Date.parse("2026-06-01T12:00:00.000Z");

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const now = new Date(baseNow);
  return {
    id: "sale-1",
    title: "Evening Sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "onsite",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    heroPresentation: "cover",
    heroVideoUrl: null,
    locationName: "London Gallery",
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: "1 Test Street",
    locationAddressLine2: null,
    locationCity: "London",
    locationCounty: null,
    locationPostcode: "W1 1AA",
    locationCountry: "United Kingdom",
    status: "scheduled",
    startTime: new Date(baseNow + 2 * 86_400_000 + 3 * 3_600_000),
    endTime: new Date(baseNow + 3 * 86_400_000),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function formatExpected(value: Date): string {
  return value.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

describe("OnsiteSaleScheduleCountdown", () => {
  it("renders four segment chips before start when more than a day remains", () => {
    vi.mocked(useClientClock).mockReturnValue(baseNow);
    const sale = makeSale();

    render(<OnsiteSaleScheduleCountdown sale={sale} />);

    expect(screen.getByText("Live event starts in")).toBeInTheDocument();
    expect(screen.getByText("Days")).toBeInTheDocument();
    expect(screen.getByText("Hours")).toBeInTheDocument();
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Sec")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("hides the Days column when under 24 hours remain", () => {
    vi.mocked(useClientClock).mockReturnValue(baseNow);
    const sale = makeSale({
      startTime: new Date(baseNow + 12 * 3_600_000),
      endTime: new Date(baseNow + 36 * 3_600_000),
    });

    render(<OnsiteSaleScheduleCountdown sale={sale} />);

    expect(screen.queryByText("Days")).not.toBeInTheDocument();
    expect(screen.getByText("Hours")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows ended state without ticking segment digits", () => {
    vi.mocked(useClientClock).mockReturnValue(baseNow);
    const sale = makeSale({
      startTime: new Date(baseNow - 48 * 3_600_000),
      endTime: new Date(baseNow - 24 * 3_600_000),
    });

    render(<OnsiteSaleScheduleCountdown sale={sale} />);

    expect(screen.getByText("This event has ended")).toBeInTheDocument();
    expect(screen.queryByText("Days")).not.toBeInTheDocument();
    expect(screen.queryByText("Hours")).not.toBeInTheDocument();
    expect(screen.queryByText("Min")).not.toBeInTheDocument();
    expect(screen.queryByText("Sec")).not.toBeInTheDocument();
  });

  it("shows live label without ended copy when active saleroom sale runs past scheduled end", () => {
    vi.mocked(useClientClock).mockReturnValue(baseNow);
    const sale = makeSale({
      status: "active",
      startTime: new Date(baseNow - 48 * 3_600_000),
      endTime: new Date(baseNow - 24 * 3_600_000),
    });

    render(<OnsiteSaleScheduleCountdown sale={sale} />);

    expect(screen.getByText(/Auction in progress/i)).toBeInTheDocument();
    expect(screen.queryByText("This event has ended")).not.toBeInTheDocument();
    expect(screen.queryByText("Ended")).not.toBeInTheDocument();
  });

  it("applies live phase label when sale is active", () => {
    vi.mocked(useClientClock).mockReturnValue(baseNow);
    const sale = makeSale({
      startTime: new Date(baseNow - 3_600_000),
      endTime: new Date(baseNow + 5 * 3_600_000),
    });

    const { container } = render(<OnsiteSaleScheduleCountdown sale={sale} />);

    expect(screen.getByText(/Auction in progress · ends in/i)).toBeInTheDocument();
    expect(container.querySelector(".live-dot-pulse")).toBeTruthy();
    expect(screen.getByText(/Session ends ·/i)).toBeInTheDocument();
  });

  it("shows static datetime when reduced motion is enabled", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    vi.mocked(useClientClock).mockReturnValue(baseNow);
    const sale = makeSale({
      startTime: new Date(baseNow + 12 * 3_600_000),
      endTime: new Date(baseNow + 36 * 3_600_000),
    });

    render(<OnsiteSaleScheduleCountdown sale={sale} />);

    expect(screen.queryByText("Hours")).not.toBeInTheDocument();
    expect(screen.getByText(formatExpected(sale.startTime))).toBeInTheDocument();
  });
});
