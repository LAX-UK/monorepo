import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LotTimeEffects } from "./lot-time-effects";

const CLOSE = Date.parse("2026-11-15T18:00:00.000Z");
const start = vi.hoisted(() => vi.fn(() => () => undefined));
const refreshFromServer = vi.fn();
const page = vi.hoisted(() => ({ lifecycle: "closing" as string }));

vi.mock("@/lib/lot-page/closing-result-fallback", () => ({ startClosingFetches: start }));
vi.mock("@/components/lot-page/lot-announcer", () => ({ useAnnounce: () => () => undefined }));
vi.mock("@/lib/context/lot-bid-history-provider", () => ({
  useLotBidHistory: () => ({ refreshFromServer }),
}));
vi.mock("@/components/lot-page/lot-page-view-context", () => ({
  useLotPageViewContext: () => ({
    live: true,
    view: {
      lifecycle: page.lifecycle,
      msLeft: 0,
      rows: [{ countdown: { kind: "closes", targetMs: CLOSE, extensions: 0 } }],
    },
  }),
}));

describe("LotTimeEffects", () => {
  it("at the close it starts the bounded result asks, measured from the close on the server clock", () => {
    const { unmount } = render(<LotTimeEffects />);
    expect(start).toHaveBeenCalledTimes(1);
    const [ask, closedAtMs, now] = start.mock.calls[0] as unknown as [
      () => unknown,
      number,
      () => number,
    ];
    expect(closedAtMs).toBe(CLOSE);
    expect(typeof now()).toBe("number");
    ask();
    expect(refreshFromServer).toHaveBeenCalledWith({ silent: true });
    unmount();
  });

  it("asks nothing while the lot is live", () => {
    start.mockClear();
    page.lifecycle = "live";
    render(<LotTimeEffects />);
    expect(start).not.toHaveBeenCalled();
  });
});
