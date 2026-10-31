import { parseBidsListQuery } from "@/lib/bid/bids-list";
import type { MyBidCardVm, MyBidsVm } from "@/lib/bid/my-bids.vm";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/bids",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/dashboard/bid-history-drawer", () => ({ BidHistoryDrawer: () => null }));
vi.mock("./my-bids-live-updates", () => ({ MyBidsLiveUpdates: () => null }));

import { BidsView } from "./bids-view";

const won = { id: "b1", lotId: "l1", title: "Harbour Light", status: "won" } as MyBidCardVm;
const vm: MyBidsVm = {
  cardsByTab: { active: [], won: [won], lost: [] },
  sales: [],
  placers: [],
  liveLots: [],
};

function renderView(offersSales: boolean) {
  render(
    <BidsView
      vm={vm}
      registrations={undefined}
      query={parseBidsListQuery({})}
      organisation={null}
      shared={false}
      offersSales={offersSales}
      bidBlockedReason={null}
      userId={null}
    />,
  );
}

describe("BidsView", () => {
  it("keeps Active as the view and points its empty state to the sales", () => {
    renderView(true);
    expect(screen.getByRole("heading", { name: "No open bids" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse upcoming sales" })).toBeInTheDocument();
  });

  it("offers no way to the sales to a member who may not bid", () => {
    renderView(false);
    expect(screen.getByRole("heading", { name: "No open bids" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse upcoming sales" })).toBeNull();
  });
});
