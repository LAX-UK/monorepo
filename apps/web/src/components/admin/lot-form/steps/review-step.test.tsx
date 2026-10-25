import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { LotFormReviewStep } from "./review-step";

const values = {
  title: "Harbour at dusk",
  auctionType: "english",
  saleId: "sale_1",
  sellerLegalEntityId: "le_1",
  sellerDisplayName: "Hartley Fine Art",
  lotNumber: 12,
  reservePrice: "",
  startingPrice: "1200.00",
  endTime: "2026-11-04T18:30",
  images: ["a.jpg", "b.jpg"],
  categoryIds: ["c2"],
} as unknown as AdminLotFormValues;

describe("LotFormReviewStep", () => {
  it("reads each answer in plain words, and goes back to a step with Change", () => {
    const onEditStep = vi.fn();
    const form = { getValues: () => values } as UseFormReturn<AdminLotFormValues>;
    render(
      <LotFormReviewStep
        form={form}
        onEditStep={onEditStep}
        sales={[{ id: "sale_1", title: "Autumn Contemporary" }]}
        categories={[
          {
            id: "c1",
            name: "Paintings",
            children: [{ id: "c2", name: "Oil", children: [] }],
          } as never,
        ]}
      />,
    );
    const identity = screen.getByRole("region", { name: "Identity" });
    expect(within(identity).getByText("English")).toBeInTheDocument();
    const sale = screen.getByRole("region", { name: "Sale and seller" });
    expect(within(sale).getByText("Autumn Contemporary")).toBeInTheDocument();
    const catalogue = screen.getByRole("region", { name: "Catalogue" });
    expect(within(catalogue).getByText("£1,200.00")).toBeInTheDocument();
    expect(within(catalogue).getByText("No reserve")).toBeInTheDocument();
    expect(within(catalogue).getByText("Oil")).toBeInTheDocument();
    expect(within(catalogue).getByText(/4 Nov 2026, 18:30/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change sale and seller" }));
    expect(onEditStep).toHaveBeenCalledWith(1);
  });
});
