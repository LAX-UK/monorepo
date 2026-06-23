import { ConfirmedRemoveButton } from "@/components/admin/confirmed-remove-button";
import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("ConfirmedRemoveButton", () => {
  it("does not call onConfirmed until the dialog is confirmed", async () => {
    const onConfirmed = vi.fn().mockResolvedValue(undefined);

    renderWithViewer(
      <ConfirmedRemoveButton
        ariaLabel="Remove item"
        confirmTitle="Remove item?"
        confirmBody="This cannot be undone."
        onConfirmed={onConfirmed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove item" }));
    expect(screen.getByText("Remove item?")).toBeInTheDocument();
    expect(onConfirmed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("calls onConfirmed after confirm", async () => {
    const onConfirmed = vi.fn().mockResolvedValue(undefined);

    renderWithViewer(
      <ConfirmedRemoveButton
        ariaLabel="Remove item"
        confirmTitle="Remove item?"
        confirmBody="This cannot be undone."
        onConfirmed={onConfirmed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove item" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(onConfirmed).toHaveBeenCalledTimes(1);
    });
  });

  it("respects disabled", () => {
    const onConfirmed = vi.fn();

    renderWithViewer(
      <ConfirmedRemoveButton
        ariaLabel="Remove item"
        confirmTitle="Remove item?"
        confirmBody="This cannot be undone."
        disabled
        onConfirmed={onConfirmed}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Remove item" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByText("Remove item?")).not.toBeInTheDocument();
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
