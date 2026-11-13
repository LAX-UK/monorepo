import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const markSettledOutsideAction = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }));
vi.mock("@/lib/admin/seller-proceeds/record-agreement.actions", () => ({
  markSettledOutsideAction,
  recordSignedAgreementAction: vi.fn(),
}));
vi.mock("@/hooks/use-upload-object-lifecycle", () => ({ uploadObjectFile: vi.fn() }));

const { LotSellerProceedsSection } = await import("./lot-seller-proceeds-section");
const { buildLotSellerProceeds, RECORD_AGREEMENT_BUTTON_ID } = await import(
  "@/lib/admin/seller-proceeds/lot-seller-proceeds.vm"
);
const { FIXTURE_HELD_TERMS, fixtureLotProceeds } = await import(
  "@/lib/admin/seller-proceeds/seller-proceeds.fixture"
);

const record = {
  lotId: "lot-1",
  lot: "Lot 21",
  lotTitle: "The Lock Keeper's House",
  sellerName: "Northbank Gallery Ltd",
  hammerPence: 620_000,
  vatSetting: "standard" as const,
};

describe("LotSellerProceedsSection", () => {
  it("for a held sale, points to the one 'Record signed agreement' button in the lot header", () => {
    const state = buildLotSellerProceeds(
      fixtureLotProceeds({ agreement: null, sale: { terms: FIXTURE_HELD_TERMS } }),
    );
    render(<LotSellerProceedsSection state={state} record={record} lotId="lot-1" />);
    expect(screen.queryByRole("button", { name: "Record signed agreement" })).toBeNull();
    expect(screen.getByRole("link", { name: "Record the signed agreement" })).toHaveAttribute(
      "href",
      `#${RECORD_AGREEMENT_BUTTON_ID}`,
    );
  });

  it("offers the signed PDF through its short-lived link, in a new tab", () => {
    const state = buildLotSellerProceeds(fixtureLotProceeds());
    render(
      <LotSellerProceedsSection
        state={state}
        lotId="lot-1"
        agreementDocumentHref="/admin/lots/lot-1/signed-agreement"
      />,
    );
    const link = screen.getByRole("link", { name: /^Open signed agreement/ });
    expect(link).toHaveAttribute("href", "/admin/lots/lot-1/signed-agreement");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows no PDF link to someone who does not handle agreements", () => {
    const state = buildLotSellerProceeds(fixtureLotProceeds());
    render(<LotSellerProceedsSection state={state} lotId="lot-1" />);
    expect(screen.queryByRole("link", { name: /^Open signed agreement/ })).toBeNull();
  });

  it("when the ATG sale was already marked by someone else, says so and shows their mark", async () => {
    markSettledOutsideAction.mockResolvedValue({
      ok: false,
      error: "This sale was already marked as settled outside LAX on 12/11/2026.",
      status: 409,
    });
    const state = buildLotSellerProceeds(fixtureLotProceeds({ soldOnAtg: true }));
    render(<LotSellerProceedsSection state={state} lotId="lot-1" canSettleOutside />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as settled outside LAX" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Paid by bank transfer per runbook" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as settled" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "This sale was already marked as settled outside LAX on 12/11/2026.",
      ),
    );
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
