import { AdminLotForm } from "@/components/admin/lot-form/wizard";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const submitLotForm = vi.fn();

vi.mock("@/components/admin/form-dirty-guard", () => ({ FormDirtyGuard: () => null }));
vi.mock("@/components/admin/lot-form/lot-edit-form-context", () => ({
  LotEditDirtyReporter: () => null,
}));
vi.mock("@/components/admin/use-guarded-navigation", () => ({
  useGuardedNavigation: () => ({ guardedPush: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./steps/sale-seller-step", () => ({ LotSaleSellerStep: () => null }));
vi.mock("./steps/catalogue-step", () => ({ LotCatalogueStep: () => null }));
vi.mock("./use-lot-form-submit", async (original) => ({
  ...(await original<typeof import("./use-lot-form-submit")>()),
  submitLotForm: (...args: unknown[]) => submitLotForm(...args),
}));

const values = {
  title: "",
  description: "",
  medium: "",
  dimensions: "",
  images: [],
  imageAlts: [],
  categoryIds: ["0b9f2c3e-6a3d-4b8e-9b1e-2f7a1c6d5e40"],
  artistId: null,
  saleId: "5f0c8a2b-1d3e-4c5f-8a9b-0c1d2e3f4a5b",
  lotNumber: null,
  auctionType: "english",
  startingPrice: "100.00",
  reservePrice: "",
  buyNowPrice: "",
  buyerPremiumRate: "",
  minBidIncrement: "",
  autoBidEnabled: true,
  autoBidStepMin: "",
  autoBidStepMax: "",
  autoBidStepPresetsCsv: "",
  dutchDecrementAmount: "",
  dutchDecrementIntervalMs: "60000",
  sellerLegalEntityId: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  sellerDisplayName: "Hartley Fine Art",
  startTime: "2026-11-01T10:00",
  endTime: "2026-11-04T18:30",
} as unknown as AdminLotFormValues;

describe("AdminLotForm validation", () => {
  it("lists the errors on submit, then clears each as it is fixed without moving focus", async () => {
    render(
      <AdminLotForm
        mode="edit"
        lotId="lot-1"
        defaultValues={values}
        categories={[]}
        artists={[]}
      />,
    );
    const title = screen.getByRole("textbox", { name: "Title" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const summary = await screen.findByRole("alert");
    const link = screen.getByRole("link", { name: "Enter a title" });
    expect(link).toHaveAttribute("href", "#lot-form-title");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(submitLotForm).not.toHaveBeenCalled();

    title.focus();
    fireEvent.change(title, { target: { value: "Harbour at dusk" } });
    await waitFor(() => expect(screen.queryByRole("link", { name: "Enter a title" })).toBeNull());
    expect(title).toHaveFocus();
    expect(title).not.toHaveAttribute("aria-invalid");
  });
});
