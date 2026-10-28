import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormerMemberBidsSection } from "./former-member-bids-section";

const cancelFormerMemberBidAction = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/legal-entity/organisation-membership.actions", () => ({
  cancelFormerMemberBidAction: (...args: unknown[]) => cancelFormerMemberBidAction(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn() } }));

const bid = {
  kind: "auto_bid" as const,
  id: "lot-1",
  lotId: "lot-1",
  lotTitle: "Harbour at Dusk",
  lotNumber: 14,
  endsAt: "2026-11-04T18:00:00.000Z",
  memberUserId: "sam",
  memberName: "Sam Lee",
  maxAmount: "6200.00",
};

describe("FormerMemberBidsSection", () => {
  beforeEach(() => {
    cancelFormerMemberBidAction.mockReset();
    refresh.mockReset();
  });

  it("shows nothing when no former member left a bid", () => {
    const { container } = render(
      <FormerMemberBidsSection legalEntityId="org" entityName="Northbank" bids={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("asks before cancelling, then cancels and refreshes", async () => {
    cancelFormerMemberBidAction.mockResolvedValue({ ok: true });
    render(<FormerMemberBidsSection legalEntityId="org" entityName="Northbank" bids={[bid]} />);
    expect(screen.getByText("Lot 14 · Harbour at Dusk")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel bid" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Bids already placed stay in the sale.");
    expect(cancelFormerMemberBidAction).not.toHaveBeenCalled();

    const confirm = screen
      .getAllByRole("button", { name: "Cancel bid" })
      .find((button) => dialog.contains(button));
    fireEvent.click(confirm as HTMLElement);
    await waitFor(() =>
      expect(cancelFormerMemberBidAction).toHaveBeenCalledWith("org", {
        kind: "auto_bid",
        id: "lot-1",
        memberUserId: "sam",
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("explains a refusal", async () => {
    cancelFormerMemberBidAction.mockResolvedValue({
      ok: false,
      error: "That bid is no longer open.",
    });
    render(<FormerMemberBidsSection legalEntityId="org" entityName="Northbank" bids={[bid]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel bid" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = screen
      .getAllByRole("button", { name: "Cancel bid" })
      .find((button) => dialog.contains(button));
    fireEvent.click(confirm as HTMLElement);
    expect(await screen.findByText("That bid is no longer open.")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });
});
