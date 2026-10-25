import type { LotFulfilmentStaffRow } from "@/lib/admin/lot-fulfilment-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLotFulfilmentActions } from "./use-lot-fulfilment-actions";

const refresh = vi.fn();
const shipAction = vi.fn();
const deliveredAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminLotFulfilmentShipResultAction: (...args: unknown[]) => shipAction(...args),
  adminLotFulfilmentDeliveredResultAction: (...args: unknown[]) => deliveredAction(...args),
  adminLotFulfilmentReleaseResultAction: vi.fn(),
  adminLotFulfilmentReadyForCollectionResultAction: vi.fn(),
  adminLotFulfilmentCollectedResultAction: vi.fn(),
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
  updatedAt: "2026-10-24T09:30:00.000Z",
  lotHref: "/admin/lots/0b7e4a52-8b3c-4e97-a4d6-2c9e7b1f5a08",
  saleHref: null,
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
    for (const fn of [refresh, shipAction, deliveredAction, notifySuccess]) fn.mockReset();
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
});
