import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { fireEvent, render, screen } from "@testing-library/react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { LotFormReviewStep } from "./review-step";

describe("LotFormReviewStep", () => {
  it("calls onEditStep when Edit is clicked", () => {
    const onEditStep = vi.fn();
    const form = {
      getValues: () =>
        ({
          title: "Test vase",
          auctionType: "english",
          saleId: "",
          sellerLegalEntityId: "",
          sellerDisplayName: "",
          lotNumber: null,
          reservePrice: "",
          startingPrice: "100",
          endTime: "",
          images: [],
          categoryIds: [],
        }) as unknown as AdminLotFormValues,
    } as UseFormReturn<AdminLotFormValues>;

    render(<LotFormReviewStep form={form} onEditStep={onEditStep} />);

    expect(screen.getByText("Test vase")).toBeInTheDocument();
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    expect(editButtons[0]).toBeDefined();
    fireEvent.click(editButtons[0] as HTMLElement);
    expect(onEditStep).toHaveBeenCalledWith(0);
  });
});
