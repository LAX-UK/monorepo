import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminCapturePaymentResultAction: vi.fn(),
  adminRefundPaymentResultAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/confirm-action-button", () => ({
  ConfirmActionButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

import { AdminPaymentActions } from "./admin-payment-actions";

describe("AdminPaymentActions", () => {
  it("offers capture and refund when the viewer may write payments", () => {
    render(<AdminPaymentActions id="pay-1" status="authorized" canWrite />);
    expect(screen.getByRole("button", { name: "Capture" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refund" })).toBeTruthy();
  });

  it("offers nothing when the viewer cannot write payments", () => {
    const { container } = render(
      <AdminPaymentActions id="pay-1" status="authorized" canWrite={false} />,
    );
    expect(container.textContent).toBe("");
  });

  it("still says a refunded payment is refunded", () => {
    render(<AdminPaymentActions id="pay-1" status="refunded" canWrite={false} />);
    expect(screen.getByText("Refunded")).toBeTruthy();
  });
});
