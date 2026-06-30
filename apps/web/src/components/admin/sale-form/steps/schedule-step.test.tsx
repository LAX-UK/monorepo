import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { SaleScheduleStep } from "./schedule-step";

function ScheduleStepHarness() {
  const form = useForm<AdminSaleFormValues>({
    defaultValues: {
      deliveryMode: "online",
      startTime: "2026-06-01T10:00",
      endTime: "2026-06-07T18:00",
      previewStartTime: "",
      buyerPremiumRate: "0.25",
      buyerPremiumTiers: [],
      venueId: "",
      locationName: "",
      locationAddressLine1: "",
      locationAddressLine2: "",
      locationCity: "",
      locationCounty: "",
      locationPostcode: "",
      locationCountry: "",
      locationAddress: "",
      locationMapUrl: "",
      streamUrl: "",
      requireSaleroomGoLiveBeforeOnlineBids: true,
    } as unknown as AdminSaleFormValues,
  });

  return (
    <FormProvider {...form}>
      <SaleScheduleStep
        form={form}
        isDraft
        isSaleroom={false}
        pending={false}
        fields={[]}
        append={() => undefined}
        remove={() => undefined}
        tierBandPreview={{ ok: false }}
        formattedPreviewAddress=""
        previewMapUrl={null}
        customMapUrl={undefined}
        postcodeIsValid
      />
    </FormProvider>
  );
}

describe("SaleScheduleStep", () => {
  it("renders delivery and schedule sections for draft online sale", () => {
    render(<ScheduleStepHarness />);

    expect(screen.getByText("Delivery & venue")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Buyer premium")).toBeInTheDocument();
    expect(screen.getByText("Delivery mode")).toBeInTheDocument();
    expect(screen.getByText("Start (London)")).toBeInTheDocument();
  });
});
