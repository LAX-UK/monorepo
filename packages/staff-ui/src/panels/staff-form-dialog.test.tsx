import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaffFormDialog } from "./staff-form-dialog.js";

function renderForm(pending = false) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <StaffFormDialog
      open
      onOpenChange={onOpenChange}
      title="Can't deliver Lot 42?"
      submitLabel="Decline and email the buyer"
      tone="danger"
      pending={pending}
      onSubmit={onSubmit}
    >
      <label>
        Reason
        <input name="reason" />
      </label>
    </StaffFormDialog>,
  );
  return { onSubmit, onOpenChange };
}

describe("StaffFormDialog", () => {
  it("submits the body's form from the footer button and from Enter in a field", () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Decline and email the buyer" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.submit(screen.getByRole("form", { name: "Can't deliver Lot 42?" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("cannot be cancelled or submitted again while a decision is on its way", () => {
    const { onSubmit, onOpenChange } = renderForm(true);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Can't deliver Lot 42?" }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
