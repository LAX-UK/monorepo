import { WatchlistBoard } from "@/components/dashboard/watchlist-board";
import type { WatchlistBoardRow } from "@/components/dashboard/watchlist-board-rows";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/use-now", () => ({
  useNow: () => Date.parse("2026-01-01T12:00:00.000Z"),
}));

vi.mock("@/lib/watchlist/use-watchlist-toggle", () => ({
  useWatchlistToggle: () => ({
    watching: true,
    busy: false,
    error: null,
    announce: null,
    toggle: vi.fn(),
    loginHref: "/login?next=%2Flot%2F1",
  }),
}));

const sampleRows: WatchlistBoardRow[] = [
  {
    watchlistId: "w1",
    lotId: "l1",
    title: "Blue Canvas Study",
    artistLabel: "artist-1",
    image: null,
    medium: "Oil",
    lotNumber: 1,
    estimateLabel: "£1,000–£2,000",
    status: "active",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-01-02T00:00:00.000Z",
  },
  {
    watchlistId: "w2",
    lotId: "l2",
    title: "Red Landscape",
    artistLabel: "artist-2",
    image: null,
    medium: "Watercolour",
    lotNumber: 2,
    estimateLabel: "£500–£800",
    status: "active",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-01-02T00:00:00.000Z",
  },
];

describe("WatchlistBoard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces displayed count after client q filter", async () => {
    render(
      <WatchlistBoard rows={sampleRows} initialQ="blue" clearSearchHref="/dashboard/watchlist" />,
    );

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("1 lot")).toBeInTheDocument();
  });

  it("shows filtered empty state when q matches nothing", () => {
    render(
      <WatchlistBoard
        rows={sampleRows}
        initialQ="nonexistent"
        clearSearchHref="/dashboard/watchlist"
      />,
    );

    expect(screen.getByText(/No watched lots match this filter/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toHaveAttribute(
      "href",
      "/dashboard/watchlist",
    );
  });

  it("renders a live countdown for each active row on mobile and desktop surfaces", () => {
    render(<WatchlistBoard rows={sampleRows} initialQ="" clearSearchHref="/dashboard/watchlist" />);

    expect(screen.getAllByText("Live").length).toBeGreaterThanOrEqual(2);
  });
});
