import { WatchlistMobileList } from "@/components/dashboard/list/watchlist-mobile-list";
import type { WatchlistBoardRow } from "@/components/dashboard/watchlist-board-rows";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-now", () => ({
  useNow: () => Date.parse("2026-01-01T12:00:00.000Z"),
}));

vi.mock("@/lib/shell/shell-config-context", () => ({
  useShellConfig: () => ({ density: "normal" }),
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

const activeRow = (lotId: string, title: string): WatchlistBoardRow => ({
  watchlistId: `w-${lotId}`,
  lotId,
  title,
  artistLabel: "artist-1",
  image: null,
  medium: "Oil",
  lotNumber: 1,
  estimateLabel: "£1,000–£2,000",
  status: "active",
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-02T00:00:00.000Z",
});

const sampleRows: WatchlistBoardRow[] = [
  activeRow("l1", "Blue Canvas Study"),
  activeRow("l2", "Green Still Life"),
  {
    watchlistId: "w3",
    lotId: "l3",
    title: "Red Landscape",
    artistLabel: "artist-2",
    image: null,
    medium: "Watercolour",
    lotNumber: 2,
    estimateLabel: "£500–£800",
    status: "ended",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-01-01T06:00:00.000Z",
  },
];

describe("WatchlistMobileList", () => {
  it("renders unwatch buttons in the footer action row, not beside the thumbnail", () => {
    render(
      <WatchlistMobileList
        rows={sampleRows}
        artistNameById={{ "artist-1": "Jane Doe" }}
        selectedIds={new Set()}
        onToggleRow={() => {}}
      />,
    );

    const actionRows = screen.getAllByTestId("watchlist-mobile-actions");
    expect(actionRows).toHaveLength(3);

    const unwatchButtons = screen.getAllByRole("button", { name: /Unwatch/i });
    expect(unwatchButtons).toHaveLength(3);

    for (const button of unwatchButtons) {
      expect(button.closest("[data-testid='watchlist-mobile-actions']")).toBeTruthy();
      expect(button.closest("a[href*='/lot/']")).toBeNull();
    }
  });

  it("shows a live countdown on each active row and none on ended rows", () => {
    render(
      <WatchlistMobileList
        rows={sampleRows}
        artistNameById={{ "artist-1": "Jane Doe" }}
        selectedIds={new Set()}
        onToggleRow={() => {}}
      />,
    );

    expect(screen.getAllByText("12:00:00")).toHaveLength(2);
    expect(screen.getByText("Ended")).toBeInTheDocument();
  });
});
