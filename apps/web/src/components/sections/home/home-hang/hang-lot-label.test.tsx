import type { HangLabelModel } from "@/lib/hang/hang-label";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HangLotLabel } from "./hang-lot-label";

type Handler = (raw: unknown) => void;

const socket = vi.hoisted(() => ({
  handlers: new Map<string, Set<Handler>>(),
  emitted: [] as { event: string; payload: unknown }[],
  on(event: string, handler: Handler) {
    const set = socket.handlers.get(event) ?? new Set<Handler>();
    set.add(handler);
    socket.handlers.set(event, set);
  },
  off(event: string, handler: Handler) {
    socket.handlers.get(event)?.delete(handler);
  },
  emit(event: string, payload: unknown) {
    socket.emitted.push({ event, payload });
  },
  fire(event: string, raw: unknown) {
    for (const handler of socket.handlers.get(event) ?? []) handler(raw);
  },
}));

vi.mock("@/lib/socket", () => ({ getSocket: () => socket }));

const LIVE: HangLabelModel = {
  eyebrow: "Lot 4",
  title: "Estuary, Evening",
  price: { qualifier: "Current bid", value: "£7,000" },
  notes: ["Closes Today 21:00"],
  live: { lotId: "lot-4", currency: "GBP" },
};

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

const joins = () => socket.emitted.filter((e) => e.event === "joinLot");

function bidUpdate(lotId: string, currentPrice: string) {
  return {
    type: "bid_placed",
    lotId,
    bid: { id: "b1", amount: currentPrice, bidderId: "u1" },
    currentPrice,
  };
}

describe("HangLotLabel", () => {
  beforeEach(() => {
    socket.handlers.clear();
    socket.emitted.length = 0;
    setVisibility("visible");
  });
  afterEach(() => {
    setVisibility("visible");
  });

  it("prints the label lines", () => {
    render(<HangLotLabel model={LIVE} />);
    expect(screen.getByText("Lot 4")).toBeInTheDocument();
    expect(screen.getByText("Estuary, Evening")).toBeInTheDocument();
    expect(screen.getByText("£7,000")).toBeInTheDocument();
    expect(screen.getByText("Closes Today 21:00")).toBeInTheDocument();
  });

  it("joins the lot's room while the lot is live and the tab is visible", () => {
    render(<HangLotLabel model={LIVE} />);
    expect(joins()).toEqual([{ event: "joinLot", payload: { lotId: "lot-4" } }]);
  });

  it("swaps a new price in place, leaving the other lines alone", () => {
    render(<HangLotLabel model={LIVE} />);
    act(() => socket.fire("bidUpdate", bidUpdate("lot-4", "7500.00")));
    expect(screen.getByText("£7,500")).toBeInTheDocument();
    expect(screen.queryByText("£7,000")).not.toBeInTheDocument();
    expect(screen.getByText("Estuary, Evening")).toBeInTheDocument();
  });

  it("turns an opening bid into a current bid when the first bid arrives", () => {
    const opening: HangLabelModel = {
      ...LIVE,
      price: { qualifier: "Opening bid", value: "£1,000" },
    };
    render(<HangLotLabel model={opening} />);
    act(() => socket.fire("bidUpdate", bidUpdate("lot-4", "1100.00")));
    expect(screen.getByText("Current bid")).toBeInTheDocument();
    expect(screen.getByText("£1,100")).toBeInTheDocument();
  });

  it("ignores a bid on another lot", () => {
    render(<HangLotLabel model={LIVE} />);
    act(() => socket.fire("bidUpdate", bidUpdate("lot-9", "9999.00")));
    expect(screen.getByText("£7,000")).toBeInTheDocument();
  });

  it("leaves the room while the tab is hidden and rejoins when it returns", () => {
    render(<HangLotLabel model={LIVE} />);
    act(() => setVisibility("hidden"));
    expect(socket.emitted.filter((e) => e.event === "leaveLot")).toHaveLength(1);
    expect(socket.handlers.get("bidUpdate")?.size ?? 0).toBe(0);
    act(() => setVisibility("visible"));
    expect(joins()).toHaveLength(2);
  });

  it("keeps the last price across a hidden tab", () => {
    render(<HangLotLabel model={LIVE} />);
    act(() => socket.fire("bidUpdate", bidUpdate("lot-4", "7500.00")));
    act(() => setVisibility("hidden"));
    expect(screen.getByText("£7,500")).toBeInTheDocument();
  });

  it("never connects for a lot that cannot take bids", () => {
    const sold: HangLabelModel = {
      eyebrow: "Lot 1",
      title: "Pale Shore",
      price: { qualifier: "Sold for", value: "£2,875" },
      notes: [],
      live: undefined,
    };
    render(<HangLotLabel model={sold} />);
    expect(socket.emitted).toEqual([]);
    act(() => socket.fire("bidUpdate", bidUpdate("lot-1", "9999.00")));
    expect(screen.getByText("£2,875")).toBeInTheDocument();
  });
});
