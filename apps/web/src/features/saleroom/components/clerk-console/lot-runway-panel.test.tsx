import { LotRunwayPanel } from "@/features/saleroom/components/clerk-console/lot-runway-panel";
import type { ClerkActionPolicy } from "@/features/saleroom/types/clerk-console.types";
import type { Lot } from "@auction/types";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/admin", () => ({ adminSaleroomAdvanceAction: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const lot = (id: string, n: number, status: string, extra: Partial<Lot> = {}) =>
  ({
    id,
    saleId: "sale-1",
    lotNumber: n,
    title: `Lot ${n} title`,
    status,
    currentPrice: "0.00",
    winnerId: null,
    ...extra,
  }) as unknown as Lot;

const lots = [
  lot("l1", 1, "ended", { winnerId: "u1", currentPrice: "4200.00" }),
  lot("l2", 2, "ended"),
  lot("l3", 3, "active", { currentPrice: "9600.00" }),
  lot("l4", 4, "scheduled"),
  lot("l5", 5, "cancelled"),
];

const policy: ClerkActionPolicy = {
  advanceInRunway: false,
  advanceInDock: true,
  hammerInDock: true,
  jumpToLotInRunway: false,
};

describe("LotRunwayPanel", () => {
  beforeAll(() => {
    // jsdom does not scroll; the panel scrolls the lot on the block into view.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("reads each lot's outcome in words: sold, passed, on the block, up next, withdrawn", () => {
    render(
      <LotRunwayPanel
        saleId="sale-1"
        lots={lots}
        currentLotId="l3"
        sessionLive
        sessionStatus="live"
        policy={policy}
        hammeredLotIds={new Set()}
      />,
    );

    const rows = within(screen.getByRole("list", { name: "Lots in run order" })).getAllByRole(
      "listitem",
    );
    expect(rows[0]).toHaveTextContent("Sold");
    expect(rows[0]).toHaveTextContent("£4,200.00");
    expect(rows[1]).toHaveTextContent("Passed");
    expect(rows[2]).toHaveTextContent("On the block");
    expect(rows[2]).toHaveAttribute("aria-current", "true");
    expect(rows[3]).toHaveTextContent("Up next");
    expect(rows[4]).toHaveTextContent("Withdrawn");
  });
});
