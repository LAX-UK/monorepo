import { renderWithViewer } from "@/test/render-with-viewer";
import type { Lot, Sale } from "@auction/types";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleSetupReviewStep } from "./review-step";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const sale = {
  id: "sale-1",
  title: "Modern British",
  status: "draft",
  deliveryMode: "online",
  startTime: new Date(Date.now() + 7 * 86_400_000),
  endTime: new Date(Date.now() + 8 * 86_400_000),
  buyerPremiumRate: "0.25",
} as unknown as Sale;

const lot = (id: string) =>
  ({
    id,
    title: id,
    saleId: "sale-1",
    sellerLegalEntityId: "s1",
    images: ["a.jpg"],
    description: "Oil on canvas",
    artistReviewRequired: false,
    startTime: sale.startTime,
    endTime: sale.endTime,
  }) as Lot;

describe("SaleSetupReviewStep", () => {
  it("names each seller who must set up payouts once, not once per lot", () => {
    renderWithViewer(
      <SaleSetupReviewStep
        saleId="sale-1"
        sale={sale}
        lots={[lot("l1"), lot("l2")]}
        canPublish
        connectRequiredByLotId={{ l1: true, l2: true }}
        sellersWithoutPayouts={[
          {
            sellerLegalEntityId: "s1",
            displayName: "Jane Smith",
            lots: [
              { id: "l1", title: "l1" },
              { id: "l2", title: "l2" },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText("Jane Smith has not set up payouts (2 lots)")).toBeInTheDocument();
    expect(screen.queryByText(/Seller must finish payout setup/)).not.toBeInTheDocument();
  });
});
