import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  removeMemberAction: vi.fn(),
  transferOwnershipAction: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock("@/lib/legal-entity/member-management.actions", () => actions);
vi.mock("@/lib/ui/notify", () => ({ notify: toasts }));

import { RemoveMemberDialog } from "./remove-member-dialog";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

const LENA = { id: "lena", name: "Lena Fischer" };

/** The confirm button; its label is drawn twice (idle and loading layers), so find it by text. */
function confirmButton(label: string): HTMLElement {
  const button = screen.getAllByText(label)[0]?.closest("button");
  if (!button) throw new Error(`no ${label} button`);
  return button;
}
const ORG = "Northbank Gallery";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RemoveMemberDialog", () => {
  it("names the person and the organisation and says what happens to their bidding", () => {
    render(
      <RemoveMemberDialog
        legalEntityId="org"
        organisationName={ORG}
        member={LENA}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Remove Lena Fischer?" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Lena Fischer will lose access to Northbank Gallery straight away.",
    );
    expect(dialog).toHaveTextContent("automatic and absentee bids for Northbank Gallery stop");
    expect(dialog).toHaveTextContent("Bids they've already placed stand.");
    // A plain confirm: nothing to type.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("starts on Cancel, so Enter never removes someone by accident", () => {
    render(
      <RemoveMemberDialog
        legalEntityId="org"
        organisationName={ORG}
        member={LENA}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("removes, confirms and closes once the server agrees", async () => {
    actions.removeMemberAction.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    render(
      <RemoveMemberDialog
        legalEntityId="org"
        organisationName={ORG}
        member={LENA}
        onClose={onClose}
      />,
    );
    fireEvent.click(confirmButton("Remove member"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.removeMemberAction).toHaveBeenCalledWith("org", "lena");
    expect(toasts.success).toHaveBeenCalledWith(
      "Lena Fischer has been removed from Northbank Gallery.",
    );
  });

  it("tells the list the member is gone once the server agrees, and not when it refuses", async () => {
    actions.removeMemberAction.mockResolvedValueOnce({ ok: true });
    const onRemoved = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(
      <RemoveMemberDialog
        legalEntityId="org"
        organisationName={ORG}
        member={LENA}
        onRemoved={onRemoved}
        onClose={onClose}
      />,
    );
    fireEvent.click(confirmButton("Remove member"));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    unmount();

    actions.removeMemberAction.mockResolvedValueOnce({ ok: false, error: "No." });
    const refusedRemoved = vi.fn();
    render(
      <RemoveMemberDialog
        legalEntityId="org"
        organisationName={ORG}
        member={LENA}
        onRemoved={refusedRemoved}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(confirmButton("Remove member"));
    await waitFor(() => expect(screen.getByText("No.")).toBeInTheDocument());
    expect(refusedRemoved).not.toHaveBeenCalled();
  });

  it("stays open and says why when the server refuses", async () => {
    actions.removeMemberAction.mockResolvedValue({
      ok: false,
      code: "owner_only",
      error: "Only an owner can grant, change or remove the owner role.",
    });
    const onClose = vi.fn();
    render(
      <RemoveMemberDialog
        legalEntityId="org"
        organisationName={ORG}
        member={LENA}
        onClose={onClose}
      />,
    );
    fireEvent.click(confirmButton("Remove member"));
    expect(
      await screen.findByText("Only an owner can grant, change or remove the owner role."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
  });
});

describe("TransferOwnershipDialog", () => {
  function open(onClose = vi.fn()) {
    render(
      <TransferOwnershipDialog
        legalEntityId="org"
        organisationName={ORG}
        member={LENA}
        confirmPhrase="Transfer to Lena Fischer"
        onClose={onClose}
      />,
    );
    return { onClose, field: screen.getByLabelText(/To confirm, type/) };
  }

  it("asks for the phrase in sentence case and says what the owner becomes", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("To confirm, type Transfer to Lena Fischer");
    expect(dialog).toHaveTextContent(
      "Lena Fischer becomes an owner of Northbank Gallery, and you become an admin.",
    );
  });

  it("transfers with the typed phrase and states the old owner's new role", async () => {
    actions.transferOwnershipAction.mockResolvedValue({ ok: true });
    const { field, onClose } = open();
    fireEvent.change(field, { target: { value: "Transfer to Lena Fischer" } });
    fireEvent.click(confirmButton("Transfer ownership"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.transferOwnershipAction).toHaveBeenCalledWith(
      "org",
      "lena",
      "Transfer to Lena Fischer",
    );
    expect(toasts.success).toHaveBeenCalledWith(
      "Lena Fischer is now an owner of Northbank Gallery.",
      {
        description: "You're now an admin.",
      },
    );
  });

  it("does nothing until the phrase matches, and says why", () => {
    const { field } = open();
    fireEvent.change(field, { target: { value: "transfer to lena" } });
    const confirm = confirmButton("Transfer ownership");
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription('Type "Transfer to Lena Fischer" to confirm.');
    expect(actions.transferOwnershipAction).not.toHaveBeenCalled();
  });
});
