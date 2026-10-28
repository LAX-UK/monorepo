import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BidHistoryDrawer } from "./bid-history-drawer";

const fetchRows = vi.fn();
vi.mock("@/lib/bid/fetch-lot-bid-history.client", () => ({
  fetchLotBidHistoryRows: (...args: unknown[]) => fetchRows(...args),
}));
vi.mock("@/lib/auth/fetch-session-user.client", () => ({
  fetchSessionUserAfterAuth: async () => ({ id: "me" }),
}));

const ROWS = [
  { id: "b2", amount: "2200", createdAt: "2026-10-28T10:00:00Z", placedByUserId: "me" },
  {
    id: "b1",
    amount: "2000",
    createdAt: "2026-10-28T09:00:00Z",
    placedByUserId: "other",
    bidderRef: "Bidder 4",
  },
];

function renderDrawer() {
  return render(
    <BidHistoryDrawer open lotId="lot-1" lotTitle="The lute player" onOpenChange={() => {}} />,
  );
}

describe("BidHistoryDrawer", () => {
  beforeEach(() => fetchRows.mockReset());

  it("lists every bid with the person's own marked as theirs", async () => {
    fetchRows.mockResolvedValue(ROWS);
    renderDrawer();
    expect(await screen.findByText("You")).toBeInTheDocument();
    expect(screen.getByText("Bidder 4")).toBeInTheDocument();
  });

  it("says calmly when the history could not be read, and tries again", async () => {
    fetchRows.mockResolvedValueOnce(null).mockResolvedValueOnce(ROWS);
    renderDrawer();
    expect(await screen.findByText("We couldn't load the bid history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("You")).toBeInTheDocument();
    expect(fetchRows).toHaveBeenCalledTimes(2);
  });
});
