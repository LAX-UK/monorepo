import { LotOutcomeControls } from "@/features/saleroom/components/clerk-console/lot-outcome-controls";
import { adminSaleroomHammerAction, adminSaleroomNoSaleAction } from "@/lib/actions/admin";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminSaleroomHammerAction: vi.fn(async () => ({ ok: true })),
  adminSaleroomNoSaleAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("LotOutcomeControls", () => {
  it("keeps Hammer primary by default and Pass secondary", () => {
    render(<LotOutcomeControls saleId="sale-1" canHammer />);
    expect(screen.getByRole("button", { name: "Hold to hammer" })).toHaveClass("bg-lax-ink");
    expect(screen.getByRole("button", { name: "Hold to pass" })).not.toHaveClass("bg-lax-ink");
  });

  it("lets the caller demote Hammer so no outcome competes with a bid being entered", () => {
    render(<LotOutcomeControls saleId="sale-1" canHammer hammerVariant="secondary" />);
    expect(screen.getByRole("button", { name: "Hold to hammer" })).not.toHaveClass("bg-lax-ink");
  });

  it("explains each hold", () => {
    render(<LotOutcomeControls saleId="sale-1" canHammer />);
    expect(screen.getByRole("button", { name: "Hold to hammer" })).toHaveAccessibleDescription(
      "Press and hold to sell the lot at the current bid. Release early to cancel.",
    );
  });

  it("hammers only after a full hold, and a quick press does nothing", () => {
    vi.useFakeTimers();
    render(<LotOutcomeControls saleId="sale-1" canHammer />);
    const hammer = screen.getByRole("button", { name: "Hold to hammer" });
    fireEvent.pointerDown(hammer, { button: 0 });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerUp(hammer);
    fireEvent.click(hammer);
    expect(adminSaleroomHammerAction).not.toHaveBeenCalled();

    fireEvent.pointerDown(hammer, { button: 0 });
    act(() => vi.advanceTimersByTime(700));
    expect(adminSaleroomHammerAction).toHaveBeenCalledTimes(1);
    expect(adminSaleroomHammerAction).toHaveBeenCalledWith({ saleId: "sale-1" });
    expect(adminSaleroomNoSaleAction).not.toHaveBeenCalled();
  });
});
