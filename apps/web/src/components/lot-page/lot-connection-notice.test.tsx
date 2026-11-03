import { LotConnectionNotice } from "@/components/lot-page/lot-connection-notice";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => ({ state: "live" as string }));
const announce = vi.hoisted(() => vi.fn());

vi.mock("@/lib/connection/use-live-connection", () => ({
  useLiveConnection: () => ({ state: connection.state }),
}));
vi.mock("@/components/lot-page/lot-announcer", () => ({ useAnnounce: () => announce }));

function setState(state: string, rerender: () => void) {
  connection.state = state;
  rerender();
}

describe("LotConnectionNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connection.state = "live";
    announce.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows nothing while the connection is healthy", () => {
    render(<LotConnectionNotice />);
    expect(screen.queryByTestId("connection-notice")).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it("stays quiet through a short drop, then reconnects, pauses, restores and leaves", () => {
    const { rerender } = render(<LotConnectionNotice />);
    const redraw = () => rerender(<LotConnectionNotice />);

    setState("offline", redraw);
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.queryByTestId("connection-notice")).toBeNull();

    act(() => vi.advanceTimersByTime(1_500));
    expect(screen.getByTestId("connection-notice")).toHaveTextContent(
      "Reconnecting to live bidding",
    );
    expect(announce).toHaveBeenLastCalledWith("Reconnecting to live bidding.");

    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByTestId("connection-notice")).toHaveTextContent("Live updates paused");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();

    setState("live", redraw);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("connection-notice")).toHaveTextContent("Live bidding restored");
    expect(announce).toHaveBeenLastCalledWith("Live bidding restored.");

    act(() => vi.advanceTimersByTime(3_500));
    expect(screen.queryByTestId("connection-notice")).toBeNull();
  });

  it("does not confirm a recovery from a drop it never reported", () => {
    const { rerender } = render(<LotConnectionNotice />);
    const redraw = () => rerender(<LotConnectionNotice />);
    setState("connecting", redraw);
    act(() => vi.advanceTimersByTime(1_000));
    setState("live", redraw);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByTestId("connection-notice")).toBeNull();
  });
});
