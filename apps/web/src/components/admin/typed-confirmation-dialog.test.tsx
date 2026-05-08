import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TypedConfirmationDialog } from "./typed-confirmation-dialog";

describe("TypedConfirmationDialog", () => {
  it("renders phrase label and disables confirm until exact match", async () => {
    const onConfirm = vi.fn();

    render(
      <TypedConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Delete thing"
        actionLabel="Delete"
        confirmationPhrase="DELETE abc"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Delete thing")).toBeInTheDocument();
    expect(screen.getByText(/DELETE abc/)).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE abc" } });
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("does not call onConfirm when phrase is wrong", () => {
    const onConfirm = vi.fn();

    render(
      <TypedConfirmationDialog
        open
        onOpenChange={() => {}}
        title="Archive"
        actionLabel="Archive"
        confirmationPhrase="ARCHIVE X"
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole("button", { name: "Archive" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ARCHIVE x" } });
    expect(confirm).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
