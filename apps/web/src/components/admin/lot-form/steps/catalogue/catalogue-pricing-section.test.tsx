import { CataloguePricingSection } from "@/components/admin/lot-form/steps/catalogue/catalogue-pricing-section";
import { emptyAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

const hidden = (label: string) => ({ visible: false, label, section: "pricing" as const });
const FIELDS = {
  startingPrice: hidden("Starting price"),
  reservePrice: hidden("Reserve"),
  buyNowPrice: hidden("Buy now"),
  buyerPremiumRate: {
    visible: true,
    label: "Buyer's premium",
    placeholder: "e.g. 20",
    section: "pricing" as const,
  },
};
const SALE_TERMS = "15% up to £500,000, then 10% on the part above";

function Harness({ rate = "" }: { rate?: string }) {
  const form = useForm<AdminLotFormValues>({
    defaultValues: { ...emptyAdminLotFormValues(), buyerPremiumRate: rate },
  });
  return <CataloguePricingSection form={form} fields={FIELDS} salePremium={SALE_TERMS} />;
}

describe("CataloguePricingSection, the lot's buyer's premium", () => {
  afterEach(cleanup);

  it("shows the sale's premium under a field label, without repeating the word premium", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Buyer's premium")).toHaveTextContent(
      `Same as the sale: ${SALE_TERMS}`,
    );
  });

  it("opens a blank, focused field with no warning and no default-looking placeholder", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Set a different premium for this lot" }));
    const field = screen.getByRole("textbox", { name: /This lot's buyer's premium/ });
    expect(field).toHaveFocus();
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", "e.g. 20");
    expect(field).toHaveAccessibleDescription(/Leave blank to use the sale's\./);
    expect(screen.queryByText("This lot has its own premium")).toBeNull();
  });

  it("warns once a rate is typed, saying only what the sale charges", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Set a different premium for this lot" }));
    fireEvent.change(screen.getByRole("textbox", { name: /This lot's buyer's premium/ }), {
      target: { value: "20" },
    });
    expect(screen.getByText("This lot has its own premium")).toBeInTheDocument();
    expect(screen.getByText(`The sale charges ${SALE_TERMS}.`)).toBeInTheDocument();
  });

  it("puts a lot with its own rate back on the sale's premium", () => {
    render(<Harness rate="0.2" />);
    expect(screen.getByText("This lot has its own premium")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use the sale's premium" }));
    expect(screen.getByLabelText("Buyer's premium")).toHaveTextContent("Same as the sale:");
  });
});
