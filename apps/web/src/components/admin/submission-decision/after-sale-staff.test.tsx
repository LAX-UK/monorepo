import {
  adminDecideUnsoldChoiceAction,
  adminRemindSellerIdentityAction,
} from "@/lib/actions/admin-consignment-after-sale";
import type { StaffAfterSaleView, UnsoldLotChoice } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemindSellerButton } from "./remind-seller-button";
import { UnsoldChoiceStaffPanel } from "./unsold-choice-staff-panel";

vi.mock("@/lib/actions/admin-consignment-after-sale", () => ({
  adminDecideUnsoldChoiceAction: vi.fn(),
  adminRemindSellerIdentityAction: vi.fn(),
  adminSetRelistReserveFloorAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const unsold: NonNullable<StaffAfterSaleView["unsold"]> = {
  lotId: "lot-1",
  chooseBy: "2026-11-03T18:00:00.000Z",
  currentReserve: "5000.00",
  reserveFloor: "3000.00",
  currency: "GBP",
  choice: {
    id: "c1",
    lotId: "lot-1",
    submissionId: "s1",
    legalEntityId: "e1",
    lotEndTime: new Date("2026-10-20T18:00:00Z"),
    status: "requested",
    requestedChoice: "collect",
    requestedReserve: null,
    requestedByUserId: "u1",
    requestedByName: "Jane Smith",
    requestedAt: new Date("2026-10-21T10:00:00Z"),
    decidedChoice: null,
    decidedReserve: null,
    decidedByUserId: null,
    decidedAt: null,
    staffNote: null,
    currency: "GBP",
    createdAt: new Date("2026-10-21T10:00:00Z"),
    updatedAt: new Date("2026-10-21T10:00:00Z"),
  },
};

describe("UnsoldChoiceStaffPanel", () => {
  beforeEach(() => vi.mocked(adminDecideUnsoldChoiceAction).mockReset());

  it("shows what the seller asked and confirms it as asked", async () => {
    vi.mocked(adminDecideUnsoldChoiceAction).mockResolvedValue({ ok: true });
    render(<UnsoldChoiceStaffPanel submissionId="s1" unsold={unsold} />);
    expect(screen.getByText("Have it returned")).toBeTruthy();
    expect(screen.getByText("£5,000")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and tell the seller" }));
    await waitFor(() =>
      expect(adminDecideUnsoldChoiceAction).toHaveBeenCalledWith("s1", {
        choice: "collect",
        reserve: null,
        note: null,
      }),
    );
  });

  it("shows the confirmation once made, with no form", () => {
    render(
      <UnsoldChoiceStaffPanel
        submissionId="s1"
        unsold={{
          ...unsold,
          choice: {
            ...(unsold.choice as UnsoldLotChoice),
            status: "confirmed",
            decidedChoice: "collect",
            decidedAt: new Date("2026-10-22T10:00:00Z"),
            decidedByName: "Sam Specialist",
          },
        }}
      />,
    );
    expect(screen.getByText("Confirmed: Have it returned")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirm and tell the seller" })).toBeNull();
  });
});

describe("RemindSellerButton", () => {
  it("sends a reminder", async () => {
    vi.mocked(adminRemindSellerIdentityAction).mockResolvedValue({
      ok: true,
      data: { sent: true },
    });
    render(<RemindSellerButton submissionId="s1" canSend />);
    fireEvent.click(screen.getByRole("button", { name: "Remind the seller" }));
    await waitFor(() => expect(adminRemindSellerIdentityAction).toHaveBeenCalledWith("s1"));
  });

  it("is disabled until the next reminder may go out, pointing to when the last went", () => {
    render(
      <>
        <p id="last">Last reminded 28 Oct, 09:00.</p>
        <RemindSellerButton submissionId="s1" canSend={false} describedBy="last" />
      </>,
    );
    const button = screen.getByRole("button", { name: "Remind the seller" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-describedby")).toBe("last");
  });
});
