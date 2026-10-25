import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { Form } from "@auction/ui/components/form";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { BuyerPremiumSection } from "./buyer-premium-section";
import type { TierPreview } from "./types";

function Harness({ preview }: { preview: TierPreview }) {
  const form = useForm<AdminSaleFormValues>();
  return (
    <Form {...form}>
      <BuyerPremiumSection
        form={form}
        isDraft
        fields={[]}
        append={vi.fn()}
        remove={vi.fn()}
        tierBandPreview={preview}
      />
    </Form>
  );
}

describe("BuyerPremiumSection preview", () => {
  it("formats the preview amounts as money", () => {
    render(
      <Harness
        preview={{
          ok: true,
          kind: "tiered",
          at250k: { hammer: "250000", premium: "62500.00" },
          at600k: { hammer: "600000", premium: "150000.00" },
        }}
      />,
    );
    expect(screen.getByText(/£250,000\.00 hammer/)).toHaveTextContent("buyer premium £62,500.00");
    expect(screen.getByText(/£600,000\.00 hammer/)).toHaveTextContent("premium £150,000.00");
  });
});
