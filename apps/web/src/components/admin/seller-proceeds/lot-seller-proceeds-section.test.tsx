import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/admin/seller-proceeds/record-agreement.actions", () => ({
  markSettledOutsideAction: vi.fn(),
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
});
