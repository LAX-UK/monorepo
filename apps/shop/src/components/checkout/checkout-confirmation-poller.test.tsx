/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckoutConfirmationPoller } from "./checkout-confirmation-poller.client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CheckoutConfirmationPoller", () => {
  it("announces processing status while active", () => {
    render(<CheckoutConfirmationPoller active />);
    expect(screen.getByText(/payment is processing/i)).toBeTruthy();
  });

  it("renders nothing when inactive", () => {
    const { container } = render(<CheckoutConfirmationPoller active={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
