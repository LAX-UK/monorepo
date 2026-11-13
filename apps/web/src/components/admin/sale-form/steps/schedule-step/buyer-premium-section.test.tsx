import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { saleBuyerPremiumPreview } from "../../use-sale-tier-preview";
import { BuyerPremiumSection } from "./buyer-premium-section";

function Harness({ values }: { values: Partial<AdminSaleFormValues> }) {
  const defaults = { ...emptyAdminSaleFormValues(), ...values };
  const form = useForm<AdminSaleFormValues>({ defaultValues: defaults });
  return (
    <BuyerPremiumSection
      form={form}
      isDraft
      fields={[]}
      append={vi.fn()}
      remove={vi.fn()}
      tierBandPreview={saleBuyerPremiumPreview(defaults)}
    />
  );
}

describe("BuyerPremiumSection", () => {
  it("preselects the standard premium for a new sale and shows a worked example", () => {
    render(<Harness values={{}} />);
    expect(
      screen.getByRole("radio", { name: /Standard: 15% up to £500,000, 10% above/ }),
    ).toBeChecked();
    expect(screen.getByRole("radio", { name: /Flat rate/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Custom bands/ })).not.toBeChecked();
    expect(
      screen.getByText("On a £600,000 hammer the buyer pays £85,000 premium."),
    ).toBeInTheDocument();
  });

  it("asks for the rate when the sale charges a flat rate", () => {
    render(<Harness values={{ buyerPremiumMode: "flat", buyerPremiumRate: "0.2" }} />);
    expect(screen.getByRole("radio", { name: /Flat rate/ })).toBeChecked();
    expect(screen.getByLabelText("Flat rate")).toBeInTheDocument();
    expect(
      screen.getByText("On a £600,000 hammer the buyer pays £120,000 premium."),
    ).toBeInTheDocument();
  });
});

describe("saleBuyerPremiumPreview", () => {
  it("words the custom bands and works them slice by slice", () => {
    expect(
      saleBuyerPremiumPreview({
        buyerPremiumMode: "bands",
        buyerPremiumRate: "",
        buyerPremiumTiers: [
          { hammerThresholdMajor: "0", rate: "0.2" },
          { hammerThresholdMajor: "100000", rate: "0.1" },
        ],
      }),
    ).toEqual({
      ok: true,
      terms: "20% up to £100,000, 10% above",
      example: "On a £600,000 hammer the buyer pays £70,000 premium",
    });
  });

  it("has nothing to show for a flat rate not yet entered", () => {
    expect(
      saleBuyerPremiumPreview({
        buyerPremiumMode: "flat",
        buyerPremiumRate: "",
        buyerPremiumTiers: [],
      }),
    ).toEqual({ ok: false });
  });
});
