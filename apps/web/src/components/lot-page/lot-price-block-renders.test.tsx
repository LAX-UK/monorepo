import { LotPriceBlockView } from "@/components/lot-page/lot-price-block";
import { buildLotPageView } from "@/lib/lot-page/build-lot-page-view";
import { NO_LOT_VIEWER } from "@/lib/lot-page/lot-viewer";
import { createClockSource, createClockStore, replaceDefaultClockStore } from "@auction/ui/clock";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renders = vi.hoisted(() => ({ priceBlock: 0, factGrid: 0, bidForm: 0 }));

vi.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => false }));
vi.mock("@/lib/time/browser-clock-sync.client", () => ({
  ensureServerClockSync: () => undefined,
  browserClockSync: () => ({
    observeServerNow: () => undefined,
    notifyReconnected: () => undefined,
  }),
}));
// One of these is drawn by every render of the price block, so it counts the block's renders.
vi.mock("@/components/lot-page/lot-connection-notice", () => ({
  LotConnectionNotice: () => {
    renders.priceBlock += 1;
    return null;
  },
}));
vi.mock("@/components/lot-page/lot-action-area", () => ({
  LotActionArea: ({ context }: { context: { bidEntry: React.ReactNode } }) => context.bidEntry,
}));
vi.mock("@/components/lot-page/lot-fact-grid", async () => {
  const actual = await vi.importActual<typeof import("@/components/lot-page/lot-fact-grid")>(
    "@/components/lot-page/lot-fact-grid",
  );
  return {
    LotFactGrid: (props: Parameters<typeof actual.LotFactGrid>[0]) => {
      renders.factGrid += 1;
      return actual.LotFactGrid(props);
    },
  };
});

function BidForm() {
  renders.bidForm += 1;
  return <button type="button">Place a bid</button>;
}

const START = Date.parse("2026-11-09T12:00:00.000Z");
const END = START + 90_000;

beforeEach(() => {
  renders.priceBlock = 0;
  renders.factGrid = 0;
  renders.bidForm = 0;
  vi.useFakeTimers();
  vi.setSystemTime(START);
  replaceDefaultClockStore(
    createClockStore({
      source: createClockSource({ wallNow: () => Date.now(), monotonicNow: () => Date.now() }),
    }),
  );
});
afterEach(() => {
  replaceDefaultClockStore(null);
  vi.useRealTimers();
});

describe("the price block while the clock ticks", () => {
  it("redraws only the time fact: the price block, the fact grid and the bid form render once", () => {
    const view = buildLotPageView({
      lifecycle: "live",
      now: new Date(START),
      msLeft: END - START,
      startsAt: "2026-11-01T12:00:00.000Z",
      endsAt: new Date(END).toISOString(),
      amounts: { starting: "4200.00", current: "7000.00", hammer: null, soldForWithPremium: null },
      estimate: null,
      bidCount: 6,
      reserve: "met",
      nextBid: "7250.00",
      extendedByMs: null,
      saleroom: null,
      signedIn: true,
      viewer: { ...NO_LOT_VIEWER, registration: "approved" },
    });
    render(
      <LotPriceBlockView
        view={view}
        actions={{
          bidEntry: <BidForm />,
          lotId: "lot-1",
          artist: { id: "a1", name: "Anna Whitcombe" },
          signedIn: true,
          lotPath: "/lot/x/1",
          saleHref: "/sales/modern",
          saleLabel: "Back to the sale",
        }}
      />,
    );
    // Let the clock start, then count ten seconds of ticks.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const before = { ...renders };
    expect(screen.getByText("1m 30s")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("1m 20s")).toBeInTheDocument();
    expect(renders).toEqual(before);
    expect(renders).toEqual({ priceBlock: 1, factGrid: 1, bidForm: 1 });
  });
});
