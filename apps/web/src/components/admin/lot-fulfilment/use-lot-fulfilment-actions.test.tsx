import type { LotFulfilmentStaffRow } from "@/lib/admin/lot-fulfilment-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLotFulfilmentActions } from "./use-lot-fulfilment-actions";

const refresh = vi.fn();
const shipAction = vi.fn();
const deliveredAction = vi.fn();
const notifySuccess = vi.fn();
const refundCourierAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminLotFulfilmentShipResultAction: (...args: unknown[]) => shipAction(...args),
  adminLotFulfilmentDeliveredResultAction: (...args: unknown[]) => deliveredAction(...args),
  adminLotFulfilmentReleaseResultAction: vi.fn(),
  adminLotFulfilmentReadyForCollectionResultAction: vi.fn(),
  adminLotFulfilmentCollectedResultAction: vi.fn(),
  adminRefundGroupDeliveryResultAction: (...args: unknown[]) => refundCourierAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const row = (step: string): LotFulfilmentStaffRow => ({
  id: "0b7e4a52-8b3c-4e97-a4d6-2c9e7b1f5a08",
  title: "Blue Interior",
  context: "Lot 12 · Autumn sale",
  step,
  status: { label: step, tone: "info" },
  method: "Shipping",
  shipping: null,
  collection: null,
  updatedAt: "2026-10-24T09:30:00.000Z",
  lotHref: "/admin/lots/0b7e4a52-8b3c-4e97-a4d6-2c9e7b1f5a08",
  saleHref: null,
  saleTitle: null,
  courierPaid: [],
});

const GROUP_ID = "5d2f7c1a-9e3b-4f60-8a1d-3b7c9e2f4a61";
const QUOTE_ID = "8c4e2a17-3f5b-4d9e-b1a6-7e2c9f3d5b80";
const courier = (remainingPence: number) => ({
  paymentGroupId: GROUP_ID,
  deliveryQuoteId: QUOTE_ID,
  label: "Paid with invoice · £180.00",
  remainingPence,
  remainingLabel: `£${(remainingPence / 100).toFixed(2)}`,
});

function Harness({ target }: { target: LotFulfilmentStaffRow }) {
  const actions = useLotFulfilmentActions();
  return (
    <>
      <ul>
        {actions.actionsFor(target).map((action) => (
          <li key={action.id}>
            <button
              type="button"
              disabled={Boolean(action.disabledReason)}
              title={action.disabledReason}
              onClick={() => action.onSelect?.()}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      {actions.dialogs}
    </>
  );
}

describe("useLotFulfilmentActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, shipAction, deliveredAction, notifySuccess, refundCourierAction]) {
      fn.mockReset();
    }
  });

  it("offers only the step each lot is waiting for", () => {
    const { unmount } = render(<Harness target={row("released")} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Ship lot",
      "Ready for collection",
    ]);
    unmount();
    render(<Harness target={row("awaiting_payment")} />);
    expect(screen.getByRole("button", { name: "Release lot" })).toHaveAttribute(
      "title",
      "Opens once the buyer has paid",
    );
  });

  it("asks for carrier and tracking before shipping, then keeps an API failure in view", async () => {
    shipAction.mockResolvedValue({ ok: false, error: "The carrier is not supported." });
    render(<Harness target={row("released")} />);
    fireEvent.click(screen.getByRole("button", { name: "Ship lot" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Mark in transit" }));
    expect(screen.getAllByText("Enter the carrier.").length).toBeGreaterThan(0);
    expect(shipAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Carrier"), { target: { value: "Royal Mail" } });
    fireEvent.change(screen.getByLabelText("Tracking number"), {
      target: { value: "AB123456789GB" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark in transit" }));
    await waitFor(() =>
      expect(shipAction).toHaveBeenCalledWith("0b7e4a52-8b3c-4e97-a4d6-2c9e7b1f5a08", {
        carrier: "Royal Mail",
        trackingNumber: "AB123456789GB",
      }),
    );
    expect(await screen.findByText("The carrier is not supported.")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("confirms delivery and refreshes the queue", async () => {
    deliveredAction.mockResolvedValue({ ok: true });
    render(<Harness target={row("in_transit")} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark delivered" }));
    const confirm = (await screen.findAllByRole("button", { name: "Mark delivered" })).at(-1);
    if (!confirm) throw new Error("no confirm button");
    fireEvent.click(confirm);
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Blue Interior delivered"));
    expect(refresh).toHaveBeenCalled();
  });

  it("offers no courier refund when the courier was not paid with the invoice", () => {
    render(<Harness target={row("released")} />);
    expect(screen.queryByRole("button", { name: "Refund courier charge" })).toBeNull();
  });

  it("refunds a courier charge paid with the invoice, naming the group and the quote", async () => {
    refundCourierAction.mockResolvedValue({ ok: true });
    render(<Harness target={{ ...row("delivered"), courierPaid: [courier(18000)] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Refund courier charge" }));

    const confirm = (await screen.findAllByRole("button", { name: "Refund courier charge" })).at(
      -1,
    );
    if (!confirm) throw new Error("no confirm button");
    fireEvent.click(confirm);
    expect(
      screen.getAllByText("Enter why the courier charge is being refunded.").length,
    ).toBeGreaterThan(0);
    expect(refundCourierAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Buyer collected the lot in person instead." },
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(refundCourierAction).toHaveBeenCalledWith(GROUP_ID, QUOTE_ID, {
        reason: "Buyer collected the lot in person instead.",
        amount: "",
      }),
    );
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Courier charge refund sent for Blue Interior"),
    );
  });

  it("disables the courier refund once the courier charge has gone back", () => {
    render(<Harness target={{ ...row("delivered"), courierPaid: [courier(0)] }} />);
    expect(screen.getByRole("button", { name: "Refund courier charge" })).toHaveAttribute(
      "title",
      "Already refunded",
    );
  });
});
