import { StaffTooltipProvider } from "@auction/staff-ui";
import type { StaffDealAction } from "@auction/validators";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealActionDialog } from "./deal-action-dialog";
import { dealRecord } from "./deal.fixture";

const move = vi.fn();
const onDone = vi.fn();

vi.mock("@/lib/actions/admin/admin-private-sales", () => ({ dealMoveAction: vi.fn() }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: () => false }));

function renderDialog(action: StaffDealAction, stage: "invoiced" | "paid" = "paid") {
  return render(
    <StaffTooltipProvider>
      <DealActionDialog
        open
        onOpenChange={vi.fn()}
        deal={dealRecord({ stage })}
        action={action}
        onReload={vi.fn()}
        onDone={onDone}
        move={move as never}
      />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  move.mockResolvedValue({ ok: true, data: dealRecord() });
});

describe("DealActionDialog: releasing the work", () => {
  it("asks how it was handed over and keeps the answer with the move", async () => {
    renderDialog("release");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Release work" }));
    expect(
      await within(dialog).findByText("Say how the work was handed over."),
    ).toBeInTheDocument();
    expect(move).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox", { name: /How it was handed over/ }), {
      target: { value: "  Collected by Ada  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Release work" }));
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        "PS-0012",
        "release",
        expect.objectContaining({ reason: "Collected by Ada" }),
      ),
    );
  });
});

describe("DealActionDialog: recording a bank transfer", () => {
  it("needs the amount and the bank's reference before it sends anything", async () => {
    renderDialog("record_bank_transfer", "invoiced");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record transfer" }));
    expect(await within(dialog).findByText("Enter the amount that landed.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Give the bank's reference for the transfer."),
    ).toBeInTheDocument();
    expect(move).not.toHaveBeenCalled();
  });

  it("sends the amount in pence with the reference", async () => {
    renderDialog("record_bank_transfer", "invoiced");
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Amount received/ }), {
      target: { value: "48,000.00" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Bank reference/ }), {
      target: { value: "FP 4411" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record transfer" }));
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        "PS-0012",
        "record_bank_transfer",
        expect.objectContaining({ reason: "FP 4411", amountMinor: 4_800_000 }),
      ),
    );
  });
});

describe("DealActionDialog: refunding", () => {
  it("returns everything that is left when the amount is left empty", async () => {
    renderDialog("refund");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Refund buyer" }));
    await waitFor(() => expect(move).toHaveBeenCalled());
    expect(move.mock.calls[0]?.[2]).not.toHaveProperty("amountMinor");
  });

  it("returns only the amount that is given", async () => {
    renderDialog("refund");
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Amount to return/ }), {
      target: { value: "2,500" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Refund buyer" }));
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        "PS-0012",
        "refund",
        expect.objectContaining({ amountMinor: 250_000 }),
      ),
    );
  });
});

describe("DealActionDialog: recording a refund made at the bank", () => {
  it("needs the amount and the bank's reference, and sends the amount in pence with them", async () => {
    renderDialog("record_bank_refund");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record refund" }));
    expect(await within(dialog).findByText("Enter the amount you returned.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Give the bank's reference for the refund."),
    ).toBeInTheDocument();
    expect(move).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox", { name: /Amount returned/ }), {
      target: { value: "1,200.50" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Bank reference/ }), {
      target: { value: "BACS 77" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record refund" }));
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        "PS-0012",
        "record_bank_refund",
        expect.objectContaining({ reason: "BACS 77", amountMinor: 120_050 }),
      ),
    );
  });
});
