import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ManualReviewPaymentActions } from "./manual-review-payment-actions";

const PAYMENT_ID = "3f8a2c10-5b7d-4e69-9a41-0c2d8e6f1b37";

vi.mock("@/lib/admin/finance/admin-finance-mutations", () => ({
  captureManualReviewPaymentAction: vi.fn(),
  refundManualReviewPaymentAction: vi.fn(),
}));
vi.mock("@/components/admin/confirm-form-submit", () => ({
  ConfirmFormSubmit: ({
    children,
    disabled,
  }: {
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
}));

function refundButton() {
  return screen.getByRole("button", { name: "Refund buyer" }) as HTMLButtonElement;
}

describe("ManualReviewPaymentActions", () => {
  it("asks for a reason and keeps the refund disabled until it is long enough", () => {
    render(<ManualReviewPaymentActions paymentId={PAYMENT_ID} manualReviewReason={null} />);

    expect(refundButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason for the refund"), {
      target: { value: "too short" },
    });
    expect(refundButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason for the refund"), {
      target: { value: "Buyer paid twice, refunding the duplicate." },
    });
    expect(refundButton().disabled).toBe(false);
  });

  it("submits the reason with the refund form", () => {
    const { container } = render(
      <ManualReviewPaymentActions paymentId={PAYMENT_ID} manualReviewReason={null} />,
    );

    const reason = container.querySelector("textarea[name='reason']");
    expect(reason).not.toBeNull();
    expect(reason?.closest("form")?.id).toBe(`refund-manual-review-${PAYMENT_ID}`);
  });

  it("gives each money form its own idempotency key field", () => {
    const { container } = render(
      <ManualReviewPaymentActions paymentId={PAYMENT_ID} manualReviewReason={null} />,
    );

    expect(container.querySelectorAll("input[name='idempotencyKey']")).toHaveLength(2);
  });
});
