import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const toastSuccess = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }));
vi.mock("@/lib/admin/seller-proceeds/record-agreement.actions", () => ({
  recordSignedAgreementAction: vi.fn(),
}));
vi.mock("@/hooks/use-upload-object-lifecycle", () => ({ uploadObjectFile: vi.fn() }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
  recentReauthAttempt: () => false,
}));

const { RecordAgreementDialog } = await import("./record-agreement-dialog");

const context = {
  lotId: "00000000-0000-4000-8000-0000000000c1",
  lot: "Lot 21",
  lotTitle: "The Lock Keeper's House",
  sellerName: "Northbank Gallery Ltd",
  hammerPence: 620_000,
  vatSetting: "standard" as const,
};

function setup(
  record = vi.fn().mockResolvedValue({
    ok: true,
    data: { sellerNetPence: 530_720, sale: { kind: "released" } },
  }),
) {
  const onOpenChange = vi.fn();
  const upload = vi
    .fn()
    .mockResolvedValue({ uploadObjectId: "6f1c2b0e-3a43-4d1b-9a7e-2f7d3c0d9b11" });
  render(
    <RecordAgreementDialog
      open
      onOpenChange={onOpenChange}
      context={context}
      record={record}
      upload={upload}
      today="2026-11-13"
    />,
  );
  return { record, upload, onOpenChange };
}

async function fillAndRecord() {
  const [commission] = screen.getAllByRole("textbox");
  fireEvent.change(commission as HTMLElement, { target: { value: "12" } });
  const date = screen.getByLabelText("Signed on");
  fireEvent.change(date, { target: { value: "03/10/2026" } });
  fireEvent.blur(date);
  const pdf = new File(["%PDF"], "agreement.pdf", { type: "application/pdf" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [pdf] } });
  await screen.findByText("agreement.pdf");
  fireEvent.change(screen.getByLabelText("Why it's recorded here"), {
    target: { value: "Signed on paper at the gallery" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Record agreement" }));
  return pdf;
}

describe("RecordAgreementDialog", () => {
  beforeEach(() => {
    refresh.mockReset();
    toastSuccess.mockReset();
  });

  it("names the lot and asks for the four facts", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Record the signed agreement" });
    expect(dialog).toHaveTextContent("Lot 21 · The Lock Keeper's House · Northbank Gallery Ltd");
    expect(
      within(dialog).getByText("Charged on the hammer price. VAT is added on top."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("PDF, up to 20 MB. Kept with the consignment."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Kept in the audit log.")).toBeInTheDocument();
  });

  it("lists every missing field at the top and beside each field, and records nothing", async () => {
    const { record } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Record agreement" }));
    expect(await screen.findByText("Check 4 fields")).toBeInTheDocument();
    for (const message of [
      "Enter the commission from the signed agreement, from 0% to 50%.",
      "Enter the date it was signed, from 1 January 2000 to today.",
      "Add the signed agreement as a PDF.",
      "Say why it's recorded here, in at least 10 characters.",
    ]) {
      expect(screen.getAllByText(message).length).toBeGreaterThanOrEqual(2);
    }
    expect(record).not.toHaveBeenCalled();
  });

  it("shows what the seller would receive as the commission is typed", () => {
    setup();
    const [commission] = screen.getAllByRole("textbox");
    fireEvent.change(commission as HTMLElement, { target: { value: "12" } });
    const preview = screen.getByRole("region", { name: "What the seller would receive" });
    expect(preview).toHaveTextContent("Commission 12%−£744.00");
    expect(preview).toHaveTextContent("Seller will receive£5,307.20");
  });

  it("says the lot joins the next payout only when the API reports the sale released", async () => {
    const { record, upload, onOpenChange } = setup();
    const pdf = await fillAndRecord();
    expect(upload).toHaveBeenCalledWith(pdf);
    await waitFor(() => expect(record).toHaveBeenCalled());
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      lotId: context.lotId,
      commissionPercent: "12",
      uploadObjectId: "6f1c2b0e-3a43-4d1b-9a7e-2f7d3c0d9b11",
      reason: "Signed on paper at the gallery",
      replace: false,
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Agreement recorded. Lot 21 joins the next payout.",
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("names what still holds the payout when the API reports the sale still held", async () => {
    setup(
      vi.fn().mockResolvedValue({
        ok: true,
        data: { sellerNetPence: null, sale: { kind: "still_held", reason: "negative_net" } },
      }),
    );
    await fillAndRecord();
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Agreement recorded. Lot 21's payout is still held: Deductions are more than the hammer.",
      ),
    );
  });

  it("says only 'Agreement recorded.' when the sale was already paid", async () => {
    setup(
      vi.fn().mockResolvedValue({
        ok: true,
        data: { sellerNetPence: null, sale: { kind: "already_paid" } },
      }),
    );
    await fillAndRecord();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Agreement recorded."));
  });

  it("refuses a file that is not a PDF without uploading it", async () => {
    const { upload } = setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "scan.png", { type: "image/png" })] },
    });
    expect(upload).not.toHaveBeenCalled();
  });
});
