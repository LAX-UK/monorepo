import { SaleStatusBadge } from "@/components/marketing/sale-status-badge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sale/use-active-sale-countdown-end-iso", () => ({
  useActiveSaleCountdownEndIso: () => null,
}));

describe("SaleStatusBadge", () => {
  it("shows the live label as text, never painted over by a descendant background", () => {
    render(<SaleStatusBadge status="active" />);
    const label = screen.getByText("Live");
    const badge = label.closest("[data-tone]");

    expect(label.className).not.toMatch(/\bbg-/);
    expect(badge?.className).not.toMatch(/\[&_span\]:bg-/);
    expect(badge?.querySelector("[data-shape='dot']")).not.toBeNull();
  });
});
