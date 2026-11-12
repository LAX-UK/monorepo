import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dealRecord } from "./deal.fixture";
import { SettlementFollowUpNotice } from "./settlement-follow-up-notice";

const refresh = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/actions/admin/admin-private-sales", () => ({
  markDealArtworkSoldAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => notifySuccess(...args), error: vi.fn() },
}));

const settled = (
  follow: Partial<NonNullable<ReturnType<typeof dealRecord>["settlementFollowUp"]>>,
) =>
  dealRecord({
    stage: "settled",
    reference: "PS-0014",
    settlementFollowUp: {
      severity: "normal",
      settledAt: "2026-11-30T16:00:00.000Z",
      lock: null,
      canRetry: true,
      ...follow,
    },
  });

function renderNotice(deal: ReturnType<typeof dealRecord>, markSold = vi.fn()) {
  render(
    <StaffTooltipProvider>
      <SettlementFollowUpNotice deal={deal} markSold={markSold as never} />
    </StaffTooltipProvider>,
  );
  return markSold;
}

beforeEach(() => vi.clearAllMocks());

describe("SettlementFollowUpNotice", () => {
  it("shows nothing when the artwork is recorded sold", () => {
    renderNotice(dealRecord({ stage: "settled" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says what happened and offers Try again", () => {
    renderNotice(settled({}));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "PS-0014 settled, but the artwork's record couldn't be marked sold. Check where it is.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("confirms, and reloads the deal, when the register now shows it sold", async () => {
    const markSold = renderNotice(settled({}), vi.fn().mockResolvedValue({ ok: true }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Artwork marked sold · PS-0014"),
    );
    expect(markSold).toHaveBeenCalledWith("PS-0014");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps Try again and says why when the register could not be reached", async () => {
    renderNotice(
      settled({}),
      vi.fn().mockResolvedValue({
        ok: false,
        error: "The artwork register didn't answer. The deal is unaffected. Try again in a moment.",
        errorCode: "artwork_register_busy",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/The deal is unaffected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reloads to show the register's own words when it now shows the artwork elsewhere", async () => {
    renderNotice(
      settled({}),
      vi.fn().mockResolvedValue({
        ok: false,
        error: "It is in a sale.",
        errorCode: "artwork_unavailable",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText("It is in a sale.")).toBeInTheDocument();
  });

  it("does not offer Try again to someone who may not run deals", () => {
    renderNotice(settled({ canRetry: false }));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("is urgent when the register shows the artwork elsewhere: no retry, a link to where it is", () => {
    renderNotice(
      settled({
        severity: "urgent",
        lock: {
          reason: "in_bid_sale",
          message: "It is in a Bid sale.",
          link: { label: "Open lot in LAX Bid", target: "bid_lot", href: "/admin/lots/lot-1" },
        },
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("It may have been sold twice");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open lot in LAX Bid" })).toHaveAttribute(
      "href",
      "/admin/lots/lot-1",
    );
  });
});
