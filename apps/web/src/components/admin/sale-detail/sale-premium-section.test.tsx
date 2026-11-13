import { buildSalePremiumOverview } from "@/lib/admin/sales/sale-premium-overview";
import { StaffAccessProvider } from "@auction/staff-ui";
import type { Lot } from "@auction/types";
import { STANDARD_BUYER_PREMIUM_BANDS } from "@auction/validators";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalePremiumSection } from "./sale-premium-section";

const useSalePremium = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations", () => ({
  adminUseSalePremiumForLotsResultAction: (...args: unknown[]) => useSalePremium(...args),
}));

afterEach(() => {
  cleanup();
  useSalePremium.mockReset();
});

type OverviewLot = Pick<
  Lot,
  "id" | "lotNumber" | "title" | "status" | "winnerId" | "buyerPremiumRate"
>;
const SALE = {
  id: "sale-1",
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: [...STANDARD_BUYER_PREMIUM_BANDS],
};
const lot = (n: number, over: Partial<OverviewLot> = {}): OverviewLot => ({
  id: `lot-${n}`,
  lotNumber: n,
  title: `Work ${n}`,
  status: "draft",
  winnerId: null,
  buyerPremiumRate: "0.2500",
  ...over,
});

function draw(lots: OverviewLot[], can = true) {
  const overview = buildSalePremiumOverview(SALE, lots);
  return render(
    <StaffAccessProvider access={{ can: () => can }}>
      <SalePremiumSection saleId="sale-1" overview={overview} />
    </StaffAccessProvider>,
  );
}

describe("SalePremiumSection", () => {
  it("names the count and the first 5 lots as links, and links the rest to the filtered lots tab", () => {
    draw(Array.from({ length: 12 }, (_, i) => lot(i + 1)));
    expect(
      screen.getByText("12 unsold lots charge a different premium from the sale"),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Lots with their own premium" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Lot 1 · Work 1",
      "Lot 2 · Work 2",
      "Lot 3 · Work 3",
      "Lot 4 · Work 4",
      "Lot 5 · Work 5",
    ]);
    expect(links[0]).toHaveAttribute("href", "/admin/lots/lot-1");
    expect(screen.getByRole("link", { name: "and 7 more" })).toHaveAttribute(
      "href",
      "/admin/sales/sale-1/lots?premium=own",
    );
    expect(
      screen.getByRole("button", { name: "Use the sale's premium for 12 lots" }),
    ).toBeInTheDocument();
  });

  it("marks lots open for bidding and counts only the others on the button", () => {
    draw([lot(1), lot(2), lot(3, { status: "active" })]);
    const list = screen.getByRole("list", { name: "Lots with their own premium" });
    const open = within(list).getAllByRole("listitem")[2];
    expect(open).toHaveTextContent("Open for bidding");
    expect(within(list).getAllByText("Open for bidding")).toHaveLength(1);
    expect(
      screen.getByText("1 lot is open for bidding and keeps its premium."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use the sale's premium for 2 lots" }),
    ).toBeInTheDocument();
  });

  it("tells people who may not edit lots who to ask, without the action", () => {
    draw([lot(1)], false);
    expect(screen.queryByRole("button", { name: /Use the sale's premium/ })).toBeNull();
    expect(
      screen.getByText("Ask a cataloguer to set these lots to the sale's premium."),
    ).toBeInTheDocument();
  });

  it("keeps a failed change in the dialog, titled Lots not changed, with Try again", async () => {
    useSalePremium.mockResolvedValue({ ok: false, error: "The sale is locked." });
    draw([lot(1), lot(2)]);
    fireEvent.click(screen.getByRole("button", { name: "Use the sale's premium for 2 lots" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Use the sale's premium for 2 lots" }),
    );
    expect(await within(dialog).findByRole("alert", {}, { timeout: 5000 })).toHaveTextContent(
      "The sale is locked. None of the 2 lots changed, so you can try again.",
    );
    expect(within(dialog).getByText("Lots not changed")).toBeInTheDocument();
    useSalePremium.mockResolvedValue({ ok: true, data: { updated: 2 } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(useSalePremium).toHaveBeenCalledTimes(2), { timeout: 5000 });
  });
});
