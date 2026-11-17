import { QUOTED, deliveryFixture } from "@/lib/admin/deliveries/deliveries.fixture";
import type { ActionResult } from "@/lib/forms/form-result";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryQuoteDialog } from "./delivery-quote-dialog";

const reauth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: reauth,
}));

type Send = (input: unknown) => Promise<ActionResult<{ lotId: string }>>;

function renderDialog({
  row = deliveryFixture(),
  action = "send" as const,
  send = vi.fn<Send>(async () => ({ ok: true, data: { lotId: row.lotId } })),
} = {}) {
  const onOpenChange = vi.fn();
  const onOutcome = vi.fn();
  const view = render(
    <StaffTooltipProvider>
      <DeliveryQuoteDialog
        row={row}
        action={action}
        open
        onOpenChange={onOpenChange}
        send={send as never}
        onOutcome={onOutcome}
      />
    </StaffTooltipProvider>,
  );
  const dialog = () => within(screen.getByRole("dialog"));
  return { ...view, send, onOpenChange, onOutcome, dialog };
}

const price = () => screen.getByRole("textbox", { name: /^Price/ });
const note = () => screen.getByRole("textbox", { name: /^Note to the buyer/ });
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

async function fillAndConfirm(amount = "180") {
  fireEvent.change(price(), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: /Send this quote\?|Send the new quote\?/ });
}

beforeEach(() => reauth.mockReset());

describe("DeliveryQuoteDialog, form", () => {
  it("asks for the price and an optional note, for the buyer and destination", () => {
    const { dialog } = renderDialog();
    expect(
      dialog().getByRole("heading", { name: "Send quote for Lot 42 · Harbour at dusk" }),
    ).toBeVisible();
    expect(
      dialog().getByText(
        "For Example Trading Ltd · Paddle 118, to 12 Rue Exemple, 69002 Lyon, France.",
      ),
    ).toBeVisible();
    expect(price()).toHaveValue("");
    expect(note()).toHaveAttribute("maxLength", "500");
    expect(dialog().getByText("Optional")).toBeVisible();
  });

  it("with one field wrong, says so at the field and focuses it, with no summary", async () => {
    const { send } = renderDialog();
    // Focus elsewhere first: the dialog opens on the price field.
    note().focus();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter an amount above zero")).toBeVisible();
    expect(screen.queryByText("There is a problem")).toBeNull();
    expect(price()).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(price()).toHaveFocus());
    expect(send).not.toHaveBeenCalled();
  });

  it("with both fields wrong, adds the summary linking to each field", async () => {
    renderDialog();
    fireEvent.change(price(), { target: { value: "12.345" } });
    fireEvent.change(note(), { target: { value: "x".repeat(501) } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const summary = await screen.findByText("There is a problem");
    const box = summary.closest("[tabindex]") as HTMLElement;
    expect(
      within(box).getByRole("link", {
        name: "Price: Enter an amount in pounds, like 240 or 240.50",
      }),
    ).toBeInTheDocument();
    expect(
      within(box).getByRole("link", {
        name: "Note to the buyer: Keep the note to 500 characters or fewer",
      }),
    ).toBeInTheDocument();
  });

  it("refuses a price of zero in the route's words", async () => {
    renderDialog();
    fireEvent.change(price(), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter an amount above zero")).toBeVisible();
  });

  it("opens Change quote with the price and note already there, and the old price said", () => {
    const { dialog } = renderDialog({ row: QUOTED, action: "change" as never });
    expect(
      dialog().getByRole("heading", { name: "Change quote for Lot 42 · Harbour at dusk" }),
    ).toBeVisible();
    expect(price()).toHaveValue("180.00");
    expect(note()).toHaveValue("Insured, two-person delivery");
    expect(dialog().getByText("The buyer was quoted £180.00.")).toBeVisible();
  });
});

describe("DeliveryQuoteDialog, confirm and send", () => {
  it("confirms who is emailed and for how much before anything is sent (money to a customer)", async () => {
    const { send, dialog } = renderDialog();
    fireEvent.change(note(), { target: { value: "Two-person delivery" } });
    await fillAndConfirm("1250");
    expect(
      dialog().getByText(
        "Send a quote of £1,250.00 to Example Trading Ltd · Paddle 118? They are emailed and can accept it from their purchase page.",
      ),
    ).toBeVisible();
    expect(dialog().getByText("Two-person delivery")).toBeVisible();
    expect(send).not.toHaveBeenCalled();
    // Back keeps what was typed.
    fireEvent.click(dialog().getByRole("button", { name: "Back" }));
    expect(price()).toHaveValue("1,250.00");
  });

  it("says the old price can no longer be accepted when changing it", async () => {
    const { dialog } = renderDialog({ row: QUOTED, action: "change" as never });
    await fillAndConfirm("200");
    expect(
      dialog().getByText(
        "Send a new quote of £200.00 to Example Trading Ltd · Paddle 118? The buyer is emailed the new price. The old one can no longer be accepted.",
      ),
    ).toBeVisible();
    expect(dialog().getByRole("button", { name: "Send the new quote" })).toBeVisible();
  });

  it("sends pence, what the dialog saw and one Idempotency-Key, and is busy while sending", async () => {
    let finish: (value: ActionResult<{ lotId: string }>) => void = () => {};
    const send = vi.fn<Send>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { onOutcome, onOpenChange, dialog } = renderDialog({ send });
    await fillAndConfirm("180");
    fireEvent.click(dialog().getByRole("button", { name: "Send quote" }));
    expect(send).toHaveBeenCalledTimes(1);
    const input = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input).toMatchObject({
      lotId: deliveryFixture().lotId,
      pence: 18_000,
      note: "",
      expected: { status: "requested", quotedAt: null },
    });
    expect(input.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    // Sending: the button is busy, Back waits, a second press sends nothing more.
    expect(dialog().getByRole("button", { name: /Send quote/ })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(dialog().getByRole("button", { name: "Back" })).toBeDisabled();
    fireEvent.click(dialog().getByRole("button", { name: /Send quote/ }));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true, data: { lotId: "x" } }));
    expect(onOutcome).toHaveBeenCalledWith({ kind: "sent" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog and says the quote wasn't sent when it fails; Try again reuses the key", async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce({
        ok: false,
        error: "The Bid API didn't answer. Nothing was sent to the buyer. Try again.",
        errorCode: "unavailable",
      })
      .mockResolvedValueOnce({ ok: true, data: { lotId: "x" } });
    const { onOutcome, onOpenChange, dialog } = renderDialog({ send });
    await fillAndConfirm();
    fireEvent.click(dialog().getByRole("button", { name: "Send quote" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The quote wasn't sent")).toBeVisible();
    expect(
      within(alert).getByText(
        "The Bid API didn't answer. Nothing was sent to the buyer. Try again.",
      ),
    ).toBeVisible();
    expect(onOutcome).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(dialog().getByRole("button", { name: "Send quote" }));
    await flush();
    const keys = send.mock.calls.map(
      (call) => (call[0] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
    expect(onOutcome).toHaveBeenCalledWith({ kind: "sent" });
  });

  it("says the buyer changed the request, offers the way back, and tells the panel (D6)", async () => {
    const send = vi.fn<Send>(async () => ({
      ok: false,
      error: "The buyer changed this request while you were pricing it.",
      errorCode: "quote_changed",
    }));
    const { onOutcome, onOpenChange, dialog } = renderDialog({ send });
    await fillAndConfirm();
    fireEvent.click(dialog().getByRole("button", { name: "Send quote" }));
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("The buyer changed this request while you were pricing it."),
    ).toBeVisible();
    expect(within(alert).getByText("Check it and try again.")).toBeVisible();
    expect(onOutcome).toHaveBeenCalledWith({ kind: "moved", by: "buyer" });
    expect(dialog().queryByRole("button", { name: "Send quote" })).toBeNull();
    fireEvent.click(dialog().getByRole("button", { name: "Back to the delivery" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says someone at LAX already quoted it, with their price", async () => {
    const send = vi.fn<Send>(async () => ({
      ok: false,
      error: "Someone at LAX quoted this delivery while you were pricing it.",
      errorCode: "already_quoted",
      meta: { amountMinor: 20_000 },
    }));
    const { onOutcome, dialog } = renderDialog({ send });
    await fillAndConfirm();
    fireEvent.click(dialog().getByRole("button", { name: "Send quote" }));
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("Someone at LAX quoted this delivery while you were pricing it."),
    ).toBeVisible();
    expect(
      within(alert).getByText("The buyer was sent £200.00. Check it before you change it."),
    ).toBeVisible();
    expect(onOutcome).toHaveBeenCalledWith({ kind: "moved", by: "staff" });
  });

  it("says the person can't send quotes when the server refuses their role", async () => {
    const send = vi.fn<Send>(async () => ({
      ok: false,
      error: "You can't send delivery quotes",
      errorCode: "forbidden",
      status: 403,
    }));
    const { dialog } = renderDialog({ send });
    await fillAndConfirm();
    fireEvent.click(dialog().getByRole("button", { name: "Send quote" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("You can't send delivery quotes")).toBeVisible();
    expect(
      within(alert).getByText(
        "Fulfilment and Administrators send them. Nothing was sent to the buyer.",
      ),
    ).toBeVisible();
    expect(dialog().queryByRole("button", { name: "Send quote" })).toBeNull();
  });

  it("asks for a fresh sign-in with the kit's dialog when the sign-in is too old", async () => {
    const send = vi.fn<Send>(async () => ({
      ok: false,
      error: "Recent sign-in required",
      status: 403,
      errorCode: "step_up_required",
    }));
    const { onOutcome } = renderDialog({ send });
    await fillAndConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Send quote" }));
    expect(await screen.findByRole("heading", { name: "Confirm it’s you" })).toBeVisible();
    expect(
      screen.getByText(
        "To send a quote of £180.00, sign in again. You will come back to this page to finish.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(reauth).toHaveBeenCalledTimes(1);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it("starts a fresh attempt, with a new key, each time it opens", async () => {
    const send = vi.fn<Send>(async () => ({ ok: false, error: "x", errorCode: "unavailable" }));
    const row = deliveryFixture();
    const props = { row, action: "send" as const, send: send as never, onOutcome: vi.fn() };
    const { rerender } = render(<DeliveryQuoteDialog {...props} open onOpenChange={vi.fn()} />);
    await fillAndConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Send quote" }));
    await screen.findByRole("alert");
    rerender(<DeliveryQuoteDialog {...props} open={false} onOpenChange={vi.fn()} />);
    rerender(<DeliveryQuoteDialog {...props} open onOpenChange={vi.fn()} />);
    expect(price()).toHaveValue("");
    await fillAndConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Send quote" }));
    await flush();
    const keys = send.mock.calls.map(
      (call) => (call[0] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });
});
