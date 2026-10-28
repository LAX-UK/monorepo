import { InvitePeopleDialog } from "@/components/admin/invite-people-dialog";
import { actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();
const mockCreate = vi.fn();
const mockSuccess = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/lib/actions/admin/admin-invitations", () => ({
  adminCreateInvitationResultAction: (...args: unknown[]) => mockCreate(...args),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    error: vi.fn(),
    success: (...args: unknown[]) => mockSuccess(...args),
    warning: vi.fn(),
  },
}));

async function addEmail(email: string) {
  const input = screen.getByLabelText("Recipients");
  fireEvent.change(input, { target: { value: email } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("InvitePeopleDialog", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockCreate.mockReset();
    mockSuccess.mockReset();
  });

  it("asks for a recipient when submitted with none", async () => {
    render(<InvitePeopleDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    const summary = await screen.findByText("There is a problem");
    expect(summary).toBeTruthy();
    expect(screen.getAllByText("Enter at least one email address.")).toHaveLength(2);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("asks for platform access when inviting staff with none chosen", async () => {
    render(<InvitePeopleDialog open onOpenChange={vi.fn()} defaultRole="staff" />);
    await addEmail("ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(await screen.findAllByText("Give access to at least one platform.")).toHaveLength(2);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("asks for at least one role on each ticked platform", async () => {
    mockCreate.mockResolvedValue(actionSuccess());
    const onOpenChange = vi.fn();
    render(<InvitePeopleDialog open onOpenChange={onOpenChange} defaultRole="staff" />);
    await addEmail("ada@example.com");
    fireEvent.click(screen.getByRole("checkbox", { name: /^Bid/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(await screen.findAllByText("Choose at least one Bid role.")).toHaveLength(2);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("sends every Bid role chosen as one grant each", async () => {
    mockCreate.mockResolvedValue(actionSuccess());
    const onOpenChange = vi.fn();
    render(<InvitePeopleDialog open onOpenChange={onOpenChange} defaultRole="staff" />);
    await addEmail("ada@example.com");
    fireEvent.click(screen.getByRole("checkbox", { name: /^Bid/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Fulfilment/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Sales manager/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        email: "ada@example.com",
        targetRole: "staff",
        grants: [
          { product: "bid", role: "sales_manager" },
          { product: "bid", role: "fulfilment" },
        ],
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("explains a forbidden combination as soon as it is chosen and refuses to send", async () => {
    render(<InvitePeopleDialog open onOpenChange={vi.fn()} defaultRole="staff" />);
    await addEmail("ada@example.com");
    fireEvent.click(screen.getByRole("checkbox", { name: /^Bid/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Finance/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Compliance/ }));

    const message =
      "Compliance can't be combined with Finance. Moving money and clearing compliance checks are kept with different people.";
    expect(await screen.findByText(message)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findAllByText(message)).toHaveLength(2);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and lists the addresses that failed", async () => {
    mockCreate.mockImplementation(async (values: { email: string }) =>
      values.email === "bad@example.com"
        ? actionFailure("An invitation is already pending")
        : actionSuccess(),
    );
    const onOpenChange = vi.fn();
    render(<InvitePeopleDialog open onOpenChange={onOpenChange} />);
    await addEmail("good@example.com");
    await addEmail("bad@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send 2 invitations" }));

    expect(await screen.findByText("1 sent, 1 not sent")).toBeTruthy();
    expect(screen.getByText(/An invitation is already pending/)).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalledWith("Invitation sent");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    // Only the failed address is left to send again.
    expect(screen.getByRole("button", { name: "Remove bad@example.com" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove good@example.com" })).toBeNull();
  });

  it("closes and confirms once every invitation is sent", async () => {
    mockCreate.mockResolvedValue(actionSuccess());
    const onOpenChange = vi.fn();
    render(<InvitePeopleDialog open onOpenChange={onOpenChange} />);
    await addEmail("a@example.com");
    await addEmail("b@example.com");
    await addEmail("c@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send 3 invitations" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mockSuccess).toHaveBeenCalledWith("3 invitations sent");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("asks before discarding addresses that were entered", async () => {
    const onOpenChange = vi.fn();
    render(<InvitePeopleDialog open onOpenChange={onOpenChange} />);
    await addEmail("ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard this invitation?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove ada@example.com" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("closes straight away when nothing was entered", async () => {
    const onOpenChange = vi.fn();
    render(<InvitePeopleDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByText("Discard this invitation?")).toBeNull();
  });

  it("flags an address that is not valid instead of adding it", async () => {
    render(<InvitePeopleDialog open onOpenChange={vi.fn()} />);
    await addEmail("not-an-email");
    expect(await screen.findByText("not-an-email is not a valid email address.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Added recipients" })).toBeNull();
  });
});
