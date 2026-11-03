import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type EmailChangeTarget, StaffEmailChangeDialog } from "./staff-email-change-dialog";

const refresh = vi.fn();
const startAction = vi.fn();
const kycAction = vi.fn();
const stepUp = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminStartEmailChangeResultAction: (...args: unknown[]) => startAction(...args),
  adminEmailChangeKycRecordResultAction: (...args: unknown[]) => kycAction(...args),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({
  handleStaffStepUp: (failure: unknown) => stepUp(failure),
}));

const ada: EmailChangeTarget = {
  id: "user_1",
  name: "Ada Lovelace",
  email: "ada.old@example.com",
  kycStatus: "approved",
};
const RECORD = {
  sessionId: "kyc-1",
  firstName: "Ada",
  lastName: "Lovelace",
  dateOfBirth: "1990-12-10",
  verifiedAt: "2026-05-01T10:00:00.000Z",
};
const REASON = "Lost the old mailbox; caller matched the KYC record.";

function open(target: EmailChangeTarget | null = ada, blockedReason?: string | null) {
  const onClose = vi.fn();
  render(
    <StaffEmailChangeDialog
      target={target}
      {...(blockedReason !== undefined ? { blockedReason } : {})}
      onClose={onClose}
    />,
  );
  return { onClose };
}

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("StaffEmailChangeDialog", () => {
  beforeEach(() => {
    for (const fn of [refresh, startAction, kycAction, stepUp]) fn.mockReset();
    stepUp.mockReturnValue(false);
  });

  it("renders nothing while no one is chosen", () => {
    open(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains a refusal instead of showing the form", () => {
    open(ada, "Only an Administrator can change a staff member's email");
    expect(screen.getByText("You can't change this address")).toBeInTheDocument();
    expect(screen.getByText(/Only an Administrator/)).toBeInTheDocument();
    expect(screen.queryByLabelText("New email address")).toBeNull();
  });

  it("asks for every piece before sending, and names each one", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Send confirmation/ }));
    expect(await screen.findAllByText("Enter the new email address")).not.toHaveLength(0);
    expect(screen.getAllByText("Choose how you checked who is asking")).not.toHaveLength(0);
    expect(screen.getAllByText(/Give a reason of at least 10 characters/)).not.toHaveLength(0);
    expect(startAction).not.toHaveBeenCalled();
  });

  it("does not offer a KYC match to someone with no approved identity check", () => {
    open({ ...ada, kycStatus: "unverified" });
    expect(screen.getByRole("radio", { name: /Matches the KYC record/ })).toBeDisabled();
    expect(screen.getByText("No verified KYC record for this person.")).toBeInTheDocument();
  });

  it("shows the verified name and date of birth only after KYC is chosen, then needs a confirmation", async () => {
    kycAction.mockResolvedValue({ ok: true, data: RECORD });
    open();
    expect(kycAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Matches the KYC record/ }));
    expect(await screen.findByText("Ada Lovelace", { selector: "dd *, dd" })).toBeInTheDocument();
    expect(screen.getByText("10 December 1990")).toBeInTheDocument();
    expect(kycAction).toHaveBeenCalledWith("user_1");

    fill("New email address", "ada.new@example.com");
    fill(/^Reason/, REASON);
    fireEvent.click(screen.getByRole("button", { name: /Send confirmation/ }));
    expect(await screen.findAllByText(/Confirm the name and date of birth match/)).not.toHaveLength(
      0,
    );
    expect(startAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    startAction.mockResolvedValue({ ok: true, data: { pendingEmail: "ada.new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Send confirmation/ }));
    await waitFor(() => expect(startAction).toHaveBeenCalledTimes(1));
    expect(startAction).toHaveBeenCalledWith("user_1", {
      newEmail: "ada.new@example.com",
      reason: REASON,
      proof: { kind: "kyc_match", kycSessionId: "kyc-1" },
    });
  });

  it("falls back to an ID check when the record cannot be found", async () => {
    kycAction.mockResolvedValue({ ok: true, data: null });
    open();
    fireEvent.click(screen.getByRole("radio", { name: /Matches the KYC record/ }));
    expect(await screen.findByText("No verified KYC record to match")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("offers a retry when the record fails to load", async () => {
    kycAction.mockResolvedValueOnce({ ok: false, error: "Try again later" });
    open();
    fireEvent.click(screen.getByRole("radio", { name: /Matches the KYC record/ }));
    expect(await screen.findByText("The KYC record could not be loaded")).toBeInTheDocument();
    kycAction.mockResolvedValueOnce({ ok: true, data: RECORD });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("10 December 1990")).toBeInTheDocument();
  });

  it("sends a fresh ID check with its reference, then says what happens next", async () => {
    startAction.mockResolvedValue({ ok: true, data: { pendingEmail: "ada.new@example.com" } });
    open();
    fireEvent.click(screen.getByRole("radio", { name: /Fresh ID check/ }));
    fill("New email address", "Ada.New@Example.com");
    fill("ID check reference", "IDV-2291");
    fill(/^Reason/, REASON);
    fireEvent.click(screen.getByRole("button", { name: /Send confirmation/ }));

    expect(await screen.findByText("Confirmation sent")).toBeInTheDocument();
    expect(startAction).toHaveBeenCalledWith("user_1", {
      newEmail: "ada.new@example.com",
      reason: REASON,
      proof: { kind: "id_check", reference: "IDV-2291" },
    });
    expect(screen.getByText(/signed out on every device/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByLabelText("New email address")).toBeNull();
  });

  async function submitIdCheck() {
    fireEvent.click(screen.getByRole("radio", { name: /Fresh ID check/ }));
    fill("New email address", "ada.new@example.com");
    fill("ID check reference", "IDV-2291");
    fill(/^Reason/, REASON);
    fireEvent.click(screen.getByRole("button", { name: /Send confirmation/ }));
  }

  it("keeps what was typed and says why, when the address is taken", async () => {
    startAction.mockResolvedValue({
      ok: false,
      error: "Another account already uses that address.",
      status: 409,
    });
    open();
    await submitIdCheck();
    expect(await screen.findByText("That did not go through")).toBeInTheDocument();
    expect(screen.getByText("Another account already uses that address.")).toBeInTheDocument();
    expect(screen.getByLabelText("New email address")).toHaveValue("ada.new@example.com");
  });

  it("hands a stale sign-in to step-up and closes", async () => {
    stepUp.mockReturnValue(true);
    startAction.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    const { onClose } = open();
    await submitIdCheck();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("switches to the no-access message when the API refuses", async () => {
    startAction.mockResolvedValue({ ok: false, error: "Forbidden", status: 403 });
    open();
    await submitIdCheck();
    expect(await screen.findByText("You can't change this address")).toBeInTheDocument();
    expect(screen.queryByLabelText("New email address")).toBeNull();
  });

  it("starts clean the next time it opens", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<StaffEmailChangeDialog target={ada} onClose={onClose} />);
    fill("New email address", "ada.new@example.com");
    rerender(<StaffEmailChangeDialog target={null} onClose={onClose} />);
    rerender(<StaffEmailChangeDialog target={ada} onClose={onClose} />);
    expect(await screen.findByLabelText("New email address")).toHaveValue("");
  });
});
