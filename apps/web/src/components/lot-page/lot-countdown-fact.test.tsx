import { LotFactGrid } from "@/components/lot-page/lot-fact-grid";
import type { LotInfoRow } from "@/lib/lot-page/lot-time-rows";
import { createClockSource, createClockStore, replaceDefaultClockStore } from "@auction/ui/clock";
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let reduced = false;
vi.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => reduced }));
vi.mock("@/lib/time/browser-clock-sync.client", () => ({
  ensureServerClockSync: () => undefined,
  browserClockSync: () => ({
    observeServerNow: () => undefined,
    notifyReconnected: () => undefined,
  }),
}));

const START = Date.parse("2026-11-09T12:00:00.000Z");
const END = START + 2 * 86_400_000 + 4 * 3_600_000 + 12 * 60_000 + 33_000;

function row(
  over: Partial<LotInfoRow> & { extensions?: number; extended?: boolean; end?: number } = {},
): LotInfoRow {
  const { extensions = 0, extended = false, end = END, ...rest } = over;
  return {
    label: "Time left",
    value: "2 days 4 hours",
    sub: "Closes Wed 11 Nov, 16:12 GMT",
    tone: "calm",
    clock: true,
    countdown: {
      targetMs: end,
      kind: "closes",
      extended,
      date: { label: "Closes", value: "Wed 18 Nov", sub: "16:12 GMT" },
      sub: "Closes Wed 11 Nov, 16:12 GMT",
      extensions,
    },
    ...rest,
  };
}

beforeEach(() => {
  reduced = false;
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

describe("the lot page time fact", () => {
  it("counts seconds under seven days, in units, and ticks", () => {
    render(<LotFactGrid rows={[row()]} />);
    expect(screen.getByText("2d 04h 12m 33s")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("2d 04h 12m 32s")).toBeInTheDocument();
  });

  it("the ticking value is hidden from screen readers, who get the time to the minute", () => {
    render(<LotFactGrid rows={[row()]} />);
    const ticking = screen.getByText("2d 04h 12m 33s");
    expect(ticking).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("2 days, 4 hours, 12 minutes left")).toHaveClass("sr-only");
  });

  it("tightens from calm to closing soon to final as the clock runs down", () => {
    const { rerender } = render(<LotFactGrid rows={[row({ end: START + 90_000 })]} />);
    expect(screen.getByText("Final minutes")).toBeInTheDocument();
    rerender(<LotFactGrid rows={[row({ end: START + 30 * 60_000 })]} />);
    expect(screen.getByText("Closing soon")).toBeInTheDocument();
    rerender(<LotFactGrid rows={[row({ end: START + 5 * 3_600_000 })]} />);
    expect(screen.getByText("Time left")).toBeInTheDocument();
  });

  it("beyond a week it tells the day, then counts when seven days remain", () => {
    render(<LotFactGrid rows={[row({ end: START + 7 * 86_400_000 + 5_000 })]} />);
    expect(screen.getByText("Wed 18 Nov")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5_001);
    });
    expect(screen.getByText("7d 00h 00m 00s")).toBeInTheDocument();
  });

  it("reads Closing… at zero and never a result", () => {
    render(<LotFactGrid rows={[row({ end: START + 2_000 })]} />);
    expect(screen.getByText("2s")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2_001);
    });
    expect(screen.getByText("Closing…")).toBeInTheDocument();
    expect(screen.getByText("The result follows in a moment")).toBeInTheDocument();
  });

  it("an extended lot says Extended and what the late bid added", () => {
    render(
      <LotFactGrid
        rows={[
          {
            ...row({ extended: true, end: START + 60_000, extensions: 1 }),
            sub: "A late bid added 30 seconds · closes 12:01 GMT",
          },
        ]}
      />,
    );
    expect(screen.getByText("Extended")).toBeInTheDocument();
  });

  it("with reduced motion it changes once a minute above the final hour", () => {
    reduced = true;
    render(<LotFactGrid rows={[row()]} />);
    expect(screen.getByText("2d 04h 12m")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("2d 04h 12m")).toBeInTheDocument();
  });

  it("tints the value once for a new late bid, and not with reduced motion", () => {
    const { rerender, container } = render(
      <LotFactGrid rows={[row({ extended: true, end: START + 120_000, extensions: 0 })]} />,
    );
    rerender(<LotFactGrid rows={[row({ extended: true, end: START + 150_000, extensions: 1 })]} />);
    expect(container.querySelector("dd.bg-lax-danger-bg")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1_300);
    });
    expect(container.querySelector("dd.bg-lax-danger-bg")).toBeNull();

    reduced = true;
    rerender(<LotFactGrid rows={[row({ extended: true, end: START + 180_000, extensions: 2 })]} />);
    expect(container.querySelector("dd.bg-lax-danger-bg")).toBeNull();
  });

  it("a row that does not count is drawn as it is", () => {
    render(
      <LotFactGrid
        rows={[
          { label: "Estimate", value: "£6,000–£9,000", sub: null, tone: "calm", clock: false },
        ]}
      />,
    );
    expect(screen.getByText("£6,000–£9,000")).toBeInTheDocument();
  });

  it("the first tint plays on a lot that goes from live to extended, though its words change", () => {
    const live = row({ end: START + 120_000, extensions: 0 });
    const { rerender, container } = render(<LotFactGrid rows={[live]} />);
    // The label changes from "Closing soon"/"Final minutes" to "Extended" with the first late bid.
    rerender(
      <LotFactGrid
        rows={[
          { ...row({ extended: true, end: START + 150_000, extensions: 1 }), label: "Extended" },
        ]}
      />,
    );
    expect(screen.getByText("Extended")).toBeInTheDocument();
    expect(container.querySelector("dd.bg-lax-danger-bg")).not.toBeNull();
  });

  it("keeps one component through Closing… and back to Extended, so that bid is marked too", () => {
    const { rerender, container } = render(<LotFactGrid rows={[row({ end: START + 1_000 })]} />);
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(screen.getByText("Closing…")).toBeInTheDocument();
    rerender(<LotFactGrid rows={[row({ extended: true, end: START + 31_000, extensions: 1 })]} />);
    expect(screen.getByText("Extended")).toBeInTheDocument();
    expect(container.querySelector("dd.bg-lax-danger-bg")).not.toBeNull();
  });
});

describe("the first paint", () => {
  it("is the same words the countdown prints on its first tick", async () => {
    const { buildLotPageView } = await import("@/lib/lot-page/build-lot-page-view");
    const { NO_LOT_VIEWER } = await import("@/lib/lot-page/lot-viewer");
    const msLeft = 2 * 86_400_000 + 4 * 3_600_000 + 12 * 60_000 + 33_000;
    const view = buildLotPageView({
      lifecycle: "live",
      now: new Date(START),
      msLeft,
      startsAt: new Date(START - 86_400_000).toISOString(),
      endsAt: new Date(START + msLeft).toISOString(),
      amounts: { starting: "100", current: "200", hammer: null, soldForWithPremium: null },
      estimate: null,
      bidCount: 1,
      reserve: "none",
      nextBid: "210",
      extendedByMs: null,
      saleroom: null,
      signedIn: false,
      viewer: NO_LOT_VIEWER,
    });
    const timeRow = view.rows.find((r) => r.countdown);
    if (!timeRow) throw new Error("no time row");
    const server = renderToString(<LotFactGrid rows={[timeRow]} />);
    expect(server).toContain("2d 04h 12m 33s");
    render(<LotFactGrid rows={[timeRow]} />);
    // The first client text is the server's text, so nothing changes under the reader.
    expect(screen.getByText("2d 04h 12m 33s")).toBeInTheDocument();
  });
});
