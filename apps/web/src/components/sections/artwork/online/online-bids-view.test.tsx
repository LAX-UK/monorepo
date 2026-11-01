import { OnlineBidsView } from "@/components/sections/artwork/online/online-bids-view";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const HOUR = 60 * 60 * 1000;

vi.mock("@/hooks/use-now", () => ({ useNow: () => NOW }));
vi.mock("@/hooks/use-lot-realtime", () => ({ useLotRealtime: vi.fn() }));
vi.mock("@/lib/context/lot-bid-history-provider", () => ({
  useLotBidHistory: () => ({ entries: [], currentPrice: "4000.00" }),
}));
vi.mock("@/components/sections/artwork/onsite/live-bid-feed", () => ({
  LiveBidFeed: ({ lifecycleKind }: { lifecycleKind: string }) => (
    <p data-testid="feed-lifecycle">{lifecycleKind}</p>
  ),
}));

function renderView(lot: {
  status: "active" | "scheduled" | "ended";
  startTime: Date;
  endTime: Date;
  winnerId: string | null;
}) {
  render(
    <OnlineBidsView lotId="lot-1" lot={{ ...lot, auctionType: "english" }} currentUserId={null}>
      <span />
    </OnlineBidsView>,
  );
  return screen.getByTestId("feed-lifecycle").textContent;
}

describe("OnlineBidsView without the online lot context (signed out)", () => {
  it("classifies an active lot from its own times as live", () => {
    expect(
      renderView({
        status: "active",
        startTime: new Date(NOW - HOUR),
        endTime: new Date(NOW + 48 * HOUR),
        winnerId: "leader-1",
      }),
    ).toBe("live");
  });

  it("classifies an upcoming lot as scheduled", () => {
    expect(
      renderView({
        status: "scheduled",
        startTime: new Date(NOW + 9 * 24 * HOUR),
        endTime: new Date(NOW + 10 * 24 * HOUR),
        winnerId: null,
      }),
    ).toBe("scheduled");
  });

  it("classifies an ended lot with a winner as sold", () => {
    const ended = { status: "ended" as const, startTime: new Date(NOW - 48 * HOUR) };
    expect(renderView({ ...ended, endTime: new Date(NOW - HOUR), winnerId: "w-1" })).toBe(
      "endedSold",
    );
  });

  it("classifies an ended lot without a winner as not sold", () => {
    expect(
      renderView({
        status: "ended",
        startTime: new Date(NOW - 48 * HOUR),
        endTime: new Date(NOW - HOUR),
        winnerId: null,
      }),
    ).toBe("endedNoSale");
  });
});
