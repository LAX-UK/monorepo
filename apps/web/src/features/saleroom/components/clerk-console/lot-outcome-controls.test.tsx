import { LotOutcomeControls } from "@/features/saleroom/components/clerk-console/lot-outcome-controls";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminSaleroomHammerAction: vi.fn(),
  adminSaleroomNoSaleAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("LotOutcomeControls", () => {
  it("keeps Hammer primary by default and Pass secondary", () => {
    render(<LotOutcomeControls saleId="sale-1" canHammer />);
    expect(screen.getByRole("button", { name: "Hammer (sold)" })).toHaveClass("bg-staff-ink");
    expect(screen.getByRole("button", { name: "Pass (no sale)" })).not.toHaveClass("bg-staff-ink");
  });

  it("lets the caller demote Hammer so no outcome competes with a bid being entered", () => {
    render(<LotOutcomeControls saleId="sale-1" canHammer hammerVariant="secondary" />);
    expect(screen.getByRole("button", { name: "Hammer (sold)" })).not.toHaveClass("bg-staff-ink");
  });
});
