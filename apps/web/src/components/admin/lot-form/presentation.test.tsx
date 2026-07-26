import { AdminLotForm } from "@/components/admin/lot-form/wizard";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/form-dirty-guard", () => ({
  FormDirtyGuard: () => null,
}));

vi.mock("@/components/admin/lot-form/lot-edit-form-context", () => ({
  LotEditDirtyReporter: () => null,
}));

vi.mock("@/components/admin/use-guarded-navigation", () => ({
  useGuardedNavigation: () => ({ guardedPush: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./steps/identity-step", () => ({
  LotIdentityStep: () => <div>Identity step</div>,
}));

vi.mock("./steps/sale-seller-step", () => ({
  LotSaleSellerStep: () => <div>Sale seller step</div>,
}));

vi.mock("./steps/catalogue-step", () => ({
  LotCatalogueStep: () => <div>Catalogue step</div>,
}));

vi.mock("./steps/review-step", () => ({
  LotFormReviewStep: () => <div>Review step</div>,
}));

vi.mock("./use-lot-form-submit", () => ({
  reportLotFormValidationFailure: vi.fn(),
  submitLotForm: vi.fn(),
  validateAllLotWizardSteps: vi.fn(),
}));

const defaultValues = {
  title: "Test lot",
  description: "",
  medium: "",
  dimensions: "",
  images: [],
  imageAlts: [],
  categoryIds: [],
  artistId: null,
  saleId: null,
  lotNumber: null,
  auctionType: "english",
  startingPrice: "100.00",
  reservePrice: "",
  buyNowPrice: "",
  buyerPremiumRate: "0.25",
  sellerLegalEntityId: "",
  status: "draft",
  startTime: "",
  endTime: "",
  previewStartTime: "",
  englishOnly: false,
} as unknown as AdminLotFormValues;

describe("AdminLotForm edit presentation", () => {
  it("suppresses inline mobile footer actions when an external form id is provided", () => {
    render(
      <AdminLotForm
        mode="edit"
        lotId="lot-1"
        defaultValues={defaultValues}
        categories={[]}
        artists={[]}
        htmlFormId={CATALOG_FORM_IDS.lot}
        lotEditSection="auction"
      />,
    );

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    const footer = saveButton.parentElement;
    expect(footer).not.toBeNull();
    expect(footer?.className).toContain("hidden");
    expect(footer?.className).toContain("lg:flex");
  });

  it("keeps inline footer actions visible on all breakpoints without an external form id", () => {
    render(
      <AdminLotForm
        mode="edit"
        lotId="lot-1"
        defaultValues={defaultValues}
        categories={[]}
        artists={[]}
      />,
    );

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    const footer = saveButton.parentElement;
    expect(footer?.className).toContain("flex");
    expect(footer?.className).not.toContain("hidden lg:flex");
  });
});
