import { BOOKED_UNPAID, deliveryFixture } from "@/lib/admin/deliveries/deliveries.fixture";
import { actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeclineDeliveryAction, type DeclineDeliveryApi } from "./decline-delivery-dialog";

vi.mock("@/lib/actions/admin/admin-deliveries", () => ({ declineDeliveryAction: vi.fn() }));

const QUOTED = deliveryFixture({
  status: "quoted",
  quote: { ...BOOKED_UNPAID.quote, status: "quoted", decidedAt: null },
});

function renderAction(
  decline: DeclineDeliveryApi["decline"] = vi.fn(async () => actionSuccess()),
  row = deliveryFixture(),
) {
  const onDeclined = vi.fn();
  const onStale = vi.fn();
  render(
    <DeclineDeliveryAction
      row={row}
      onDeclined={onDeclined}
      onStale={onStale}
      api={{ decline: decline as DeclineDeliveryApi["decline"] }}
    />,
  );
  return { decline: decline as ReturnType<typeof vi.fn>, onDeclined, onStale };
}

const openDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Can't deliver" }));
  return within(screen.getByRole("dialog", { name: "Can't deliver Lot 42 · Harbour at dusk?" }));
};

describe("DeclineDeliveryAction", () => {
  it("opens on the reason, and declines the request staff saw with the trimmed reason", async () => {
    const { decline, onDeclined } = renderAction();
    const dialog = openDialog();
    const reason = dialog.getByLabelText("Reason for the buyer");
    await waitFor(() => expect(reason).toHaveFocus());
    expect(reason).toHaveAttribute("maxlength", "500");

    fireEvent.change(reason, { target: { value: "  We don't ship to Lyon  " } });
    fireEvent.click(dialog.getByRole("button", { name: "Decline and email the buyer" }));

    await waitFor(() => expect(onDeclined).toHaveBeenCalledTimes(1));
    expect(decline).toHaveBeenCalledWith(
      "10700000-0000-4000-8000-000000000042",
      {
        quoteId: "40070000-0000-4000-8000-000000000042",
        expectedStatus: "requested",
        reason: "We don't ship to Lyon",
      },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("sends the quote's own status for a quote already sent", async () => {
    const { decline } = renderAction(undefined, QUOTED);
    const dialog = openDialog();
    fireEvent.change(dialog.getByLabelText("Reason for the buyer"), { target: { value: "No" } });
    fireEvent.click(dialog.getByRole("button", { name: "Decline and email the buyer" }));
    await waitFor(() => expect(decline).toHaveBeenCalledTimes(1));
    expect(decline.mock.calls[0]?.[1]).toMatchObject({ expectedStatus: "quoted" });
  });

  it("says under the one field that a reason is needed, and sends nothing", async () => {
    const { decline } = renderAction();
    const dialog = openDialog();
    const reason = dialog.getByLabelText("Reason for the buyer");
    fireEvent.change(reason, { target: { value: "   " } });
    fireEvent.click(dialog.getByRole("button", { name: "Decline and email the buyer" }));
    expect(await dialog.findByText("Tell the buyer why you can't deliver")).toBeVisible();
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveFocus();
    // One field: the message is inline, with no error summary above it.
    expect(dialog.queryByRole("alert")).toBeNull();
    expect(decline).not.toHaveBeenCalled();
  });

  it.each(["quote_changed", "quote_step_not_allowed"])(
    "shows the D6 stale Notice in the dialog and reloads on %s",
    async (code) => {
      const failure = actionFailure("The delivery quote changed.", undefined, 409, code);
      const { onStale, onDeclined } = renderAction(vi.fn(async () => failure));
      const dialog = openDialog();
      fireEvent.change(dialog.getByLabelText("Reason for the buyer"), {
        target: { value: "We don't ship to Lyon" },
      });
      fireEvent.click(dialog.getByRole("button", { name: "Decline and email the buyer" }));
      const notice = await dialog.findByRole("alert");
      expect(notice).toHaveTextContent("This request changed while you had it open.");
      expect(notice).toHaveTextContent("Nothing was sent to the buyer.");
      expect(onStale).toHaveBeenCalledTimes(1);
      expect(onDeclined).not.toHaveBeenCalled();
    },
  );

  it("keeps one Idempotency-Key for a retried reason, and a new one for an edited reason", async () => {
    const decline = vi
      .fn()
      .mockResolvedValueOnce(actionFailure("The Bid API didn't answer.", undefined, 503))
      .mockResolvedValueOnce(actionFailure("The Bid API didn't answer.", undefined, 503))
      .mockResolvedValueOnce(actionSuccess());
    renderAction(decline);
    const dialog = openDialog();
    const reason = dialog.getByLabelText("Reason for the buyer");
    const submit = dialog.getByRole("button", { name: "Decline and email the buyer" });
    fireEvent.change(reason, { target: { value: "We don't ship to Lyon" } });
    fireEvent.click(submit);
    expect(await dialog.findByRole("alert")).toHaveTextContent("The Bid API didn't answer.");
    fireEvent.click(submit);
    await waitFor(() => expect(decline).toHaveBeenCalledTimes(2));
    fireEvent.change(reason, { target: { value: "We don't ship to France" } });
    fireEvent.click(submit);
    await waitFor(() => expect(decline).toHaveBeenCalledTimes(3));
    const keys = decline.mock.calls.map((call) => call[2]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("returns focus to the button on Cancel", async () => {
    renderAction();
    const button = screen.getByRole("button", { name: "Can't deliver" });
    button.focus();
    const dialog = openDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(button).toHaveFocus());
  });
});
