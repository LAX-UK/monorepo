import {
  OVERDUE,
  OVERDUE_FOLLOW_UP,
  OVERDUE_LOT,
} from "@/lib/admin/collections/not-collected.fixture";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extend: vi.fn(),
  waive: vi.fn(),
  refresh: vi.fn(),
  stepUp: vi.fn(() => false),
  toast: vi.fn(),
}));

vi.mock("@/lib/actions/admin/admin-collection-overdue", () => ({
  extendLotStorageAction: mocks.extend,
  waiveLotStorageAction: mocks.waive,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: mocks.stepUp }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: mocks.toast, error: vi.fn() } }));

const { OverdueLots } = await import("./overdue-lots");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stepUp.mockReturnValue(false);
});

const row = (name: string) => screen.getByRole("listitem", { name });

describe("the lots past their collect-by day", () => {
  it("shows each lot's days over, day and buyer, storage so far, band and the 60-day flag", () => {
    render(<OverdueLots overdue={OVERDUE} canExtend canWaive />);
    expect(screen.getByText("2 lots past collect-by")).toBeTruthy();
    const lot = row("Lot 12 · Lowland Storm");
    expect(within(lot).getByText("14 days over")).toBeTruthy();
    expect(within(lot).getByText("Collect by Sun 1 Nov · Northfield Collection Ltd")).toBeTruthy();
    expect(within(lot).getByText("£42.00")).toBeTruthy();
    expect(
      within(lot).getByText("£42.00 so far (14 days at £3 a day), plus VAT where it applies."),
    ).toBeTruthy();
    expect(within(lot).getByText("Standard")).toBeTruthy();
    expect(within(lot).queryByText("Follow up")).toBeNull();
    const old = row("Lot 31 · Harbour at Dusk");
    expect(within(old).getByText("Follow up")).toBeTruthy();
    expect(within(old).getByText("Large")).toBeTruthy();
  });

  it("says the amounts are what would be due while charging is off, and not when it is on", () => {
    const { unmount } = render(<OverdueLots overdue={OVERDUE} canExtend canWaive />);
    expect(screen.getByText(/what would be due under the terms/)).toBeTruthy();
    unmount();
    render(<OverdueLots overdue={{ ...OVERDUE, chargingOn: true }} canExtend canWaive />);
    expect(screen.queryByText(/what would be due under the terms/)).toBeNull();
  });

  it("says why Extend is blocked on a lot that has had 30 days, on the row itself", () => {
    render(<OverdueLots overdue={OVERDUE} canExtend canWaive={false} />);
    const old = row("Lot 31 · Harbour at Dusk");
    const button = within(old).getByRole("button", { name: "Extend free storage" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(within(old).getByText("This lot has had the most free days it can: 30.")).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows each role only its own action, and a read-only viewer none", () => {
    const { unmount } = render(<OverdueLots overdue={OVERDUE} canExtend canWaive={false} />);
    expect(screen.queryByRole("button", { name: "Waive charges" })).toBeNull();
    unmount();
    const finance = render(<OverdueLots overdue={OVERDUE} canExtend={false} canWaive />);
    expect(screen.queryByRole("button", { name: "Extend free storage" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Waive charges" })).toHaveLength(2);
    finance.unmount();
    render(<OverdueLots overdue={OVERDUE} canExtend={false} canWaive={false} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers no waiver on a waived lot", () => {
    render(
      <OverdueLots
        overdue={{ ...OVERDUE, lots: [{ ...OVERDUE_LOT, waived: true, amountPence: 0 }] }}
        canExtend={false}
        canWaive
      />,
    );
    expect(screen.getByText("Waived")).toBeTruthy();
    expect(screen.getByText("Charges waived")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Waive charges" })).toBeNull();
  });

  it("says so when no lot is past its day", () => {
    render(<OverdueLots overdue={{ ...OVERDUE, lots: [] }} canExtend canWaive />);
    expect(screen.getByText("No lots past their collect-by day")).toBeTruthy();
  });
});

describe("Extend free storage", () => {
  const openExtend = () => {
    render(<OverdueLots overdue={OVERDUE} canExtend canWaive={false} />);
    fireEvent.click(
      within(row("Lot 12 · Lowland Storm")).getByRole("button", { name: "Extend free storage" }),
    );
    return screen.getByRole("dialog", { name: "Extend free storage" });
  };

  it("lists both problems in a summary that links to each field, and inline", async () => {
    const dialog = openExtend();
    fireEvent.click(within(dialog).getByRole("button", { name: "Extend free storage" }));
    const summary = await within(dialog).findByRole("alert");
    expect(within(summary).getByText("2 things to fix")).toBeTruthy();
    expect(
      within(summary)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Enter a whole number of days from 1 to 30", "Enter a reason"]);
    expect(mocks.extend).not.toHaveBeenCalled();
  });

  it("goes straight to the one field at fault, without a summary", () => {
    const dialog = openExtend();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Days to add/ }), {
      target: { value: "5" },
    });
    expect(within(dialog).getByText(/^Adds 5 free days/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Extend free storage" }));
    expect(within(dialog).queryByText(/things? to fix/)).toBeNull();
    const reason = within(dialog).getByRole("textbox", { name: /^Reason/ });
    expect(document.activeElement).toBe(reason);
    expect(within(dialog).getByText("Enter a reason")).toBeTruthy();
  });

  it("sends once, shows it saving, then refreshes the list and says so", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.extend.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const dialog = openExtend();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Days to add/ }), {
      target: { value: "7" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Reason/ }), {
      target: { value: "Buyer abroad until December" },
    });
    const submit = within(dialog).getByRole("button", { name: "Extend free storage" });
    fireEvent.click(submit);
    await waitFor(() => expect(submit.getAttribute("aria-busy")).toBe("true"));
    fireEvent.click(submit);
    expect(mocks.extend).toHaveBeenCalledTimes(1);
    expect(mocks.extend).toHaveBeenCalledWith(OVERDUE.venueId, OVERDUE_LOT.lotId, {
      days: 7,
      reason: "Buyer abroad until December",
    });
    await act(async () => {
      finish({
        ok: true,
        data: { ...OVERDUE, lots: [{ ...OVERDUE_LOT, extensionDays: 7, extensionDaysLeft: 23 }] },
      });
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith("Free storage extended for Lot 12 · Lowland Storm");
    expect(screen.getByText("Extended by 7 days")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("puts the API's cap refusal on the days field", async () => {
    mocks.extend.mockResolvedValue({
      ok: false,
      error: "This lot can have up to 3 more days.",
      errorCode: "extension_cap_reached",
      status: 409,
      meta: { issues: [{ field: "days", message: "This lot can have up to 3 more days." }] },
    });
    const dialog = openExtend();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Days to add/ }), {
      target: { value: "7" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Reason/ }), {
      target: { value: "Held for a courier" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Extend free storage" }));
    expect(await within(dialog).findByText("This lot can have up to 3 more days.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("Waive charges", () => {
  const openWaive = () => {
    render(<OverdueLots overdue={OVERDUE} canExtend={false} canWaive />);
    fireEvent.click(
      within(row("Lot 31 · Harbour at Dusk")).getByRole("button", { name: "Waive charges" }),
    );
    return screen.getByRole("dialog", { name: "Waive storage charges" });
  };

  it("says what will not be charged, and asks only for the reason, inline", () => {
    const dialog = openWaive();
    expect(within(dialog).getByText(/^£396.00 so far will not be charged/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Waive charges" }));
    expect(within(dialog).queryByText(/things? to fix/)).toBeNull();
    expect(document.activeElement).toBe(within(dialog).getByRole("textbox", { name: /^Reason/ }));
    expect(within(dialog).getByText("Enter a reason")).toBeTruthy();
    expect(mocks.waive).not.toHaveBeenCalled();
  });

  it("waives with the reason and refreshes the list", async () => {
    mocks.waive.mockResolvedValue({
      ok: true,
      data: { ...OVERDUE, lots: [{ ...OVERDUE_FOLLOW_UP, waived: true, amountPence: 0 }] },
    });
    const dialog = openWaive();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Reason/ }), {
      target: { value: "Our delay in arranging the courier" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Waive charges" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.waive).toHaveBeenCalledWith(OVERDUE.venueId, OVERDUE_FOLLOW_UP.lotId, {
      reason: "Our delay in arranging the courier",
    });
    expect(mocks.toast).toHaveBeenCalledWith("Storage charges waived for Lot 31 · Harbour at Dusk");
  });

  it("keeps the dialog and says why when the API refuses", async () => {
    mocks.waive.mockResolvedValue({
      ok: false,
      error: "These charges are already waived.",
      errorCode: "already_waived",
      status: 409,
    });
    const dialog = openWaive();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Reason/ }), {
      target: { value: "Goodwill" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Waive charges" }));
    expect(await within(dialog).findByText("These charges are already waived.")).toBeTruthy();
  });

  it("sends a stale sign-in to sign in again, without an error", async () => {
    mocks.waive.mockResolvedValue({ ok: false, error: "step up", errorCode: "step_up_required" });
    mocks.stepUp.mockReturnValue(true);
    const dialog = openWaive();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Reason/ }), {
      target: { value: "Goodwill" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Waive charges" }));
    await waitFor(() => expect(mocks.stepUp).toHaveBeenCalled());
    expect(within(dialog).queryByText("Nothing was changed")).toBeNull();
  });
});
