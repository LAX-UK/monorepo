import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmActionDialog, StaffDialog } from "./staff-dialog.js";

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmActionDialog>> = {}) {
  const onConfirm = vi.fn();
  render(
    <ConfirmActionDialog
      open
      onOpenChange={() => {}}
      title="Refund £20.00 to Ada Lovelace?"
      description="The money goes back to the card used. This cannot be undone."
      confirmLabel="Refund £20.00"
      tone="danger"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return onConfirm;
}

describe("StaffDialog", () => {
  it("scrolls a tall body and keeps the actions outside it", () => {
    render(
      <StaffDialog
        open
        onOpenChange={() => {}}
        title="Invite people"
        footer={<button type="button">Send</button>}
      >
        <p>Long form</p>
      </StaffDialog>,
    );
    const body = screen.getByText("Long form").parentElement;
    expect(body).toHaveClass("overflow-y-auto");
    expect(body).not.toContainElement(screen.getByRole("button", { name: "Send" }));
  });
});

describe("ConfirmActionDialog", () => {
  it("starts on Cancel, so Enter never confirms by accident", async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("asks for a reason, says what is missing, and passes it on", async () => {
    const onConfirm = renderDialog({
      reason: { label: "Reason for the refund", minLength: 10 },
    });
    const field = screen.getByLabelText("Reason for the refund");
    // Cancel keeps the first focus even with a field to fill.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Refund £20.00" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a reason of at least 10 characters.")).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(field, { target: { value: "  Damaged in transit  " } });
    expect(screen.queryByText("Enter a reason of at least 10 characters.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refund £20.00" }));
    expect(onConfirm).toHaveBeenCalledWith({ reason: "Damaged in transit" });
  });

  it("takes a one-line answer in a single-line field, with its own message when empty", async () => {
    const onConfirm = renderDialog({
      title: "Mark £85.00 to Ada Lovelace as paid?",
      confirmLabel: "Mark £85.00 paid",
      tone: "default",
      reason: {
        label: "Transfer reference",
        singleLine: true,
        missingMessage: "Enter the reference from the transfer.",
      },
    });
    const field = screen.getByLabelText("Transfer reference");
    expect(field.tagName).toBe("INPUT");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    fireEvent.keyDown(field, { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Enter the reference from the transfer.")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: " BACS-20441 " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledWith({ reason: "BACS-20441" });
  });

  it("keeps a catastrophic action disabled until the reference is typed exactly", () => {
    const onConfirm = renderDialog({
      title: "Delete sale LAX-10432?",
      confirmLabel: "Delete sale",
      typedConfirmation: "LAX-10432",
    });
    const confirm = screen.getByRole("button", { name: "Delete sale" });
    const field = screen.getByLabelText(/Type LAX-10432 to confirm/);
    expect(confirm).toBeDisabled();
    fireEvent.change(field, { target: { value: "lax-10432" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(field, { target: { value: "LAX-10432" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith({ reason: "" });
  });
});
