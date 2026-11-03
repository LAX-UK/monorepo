/** @vitest-environment jsdom */
import { requestGuestOrderLink } from "@/app/actions/guest-checkout.actions";
import { GuestOrderLinkRequest } from "@/components/checkout/guest-order-link-request.client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/guest-checkout.actions", () => ({ requestGuestOrderLink: vi.fn() }));

const requestMock = vi.mocked(requestGuestOrderLink);

describe("GuestOrderLinkRequest", () => {
  afterEach(() => {
    cleanup();
    requestMock.mockReset();
  });

  it("lists every problem in a summary that takes focus, and marks each field", () => {
    render(<GuestOrderLinkRequest />);
    fireEvent.click(screen.getByRole("button", { name: "Email me a new link" }));
    const summary = screen.getByRole("alert");
    expect(summary.textContent).toContain("Enter the email address you used for the order");
    expect(summary.textContent).toContain("Enter the order reference, like LAX-S-10482");
    expect(document.activeElement).toBe(summary);
    expect(screen.getByLabelText("Email address").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Order reference").getAttribute("aria-invalid")).toBe("true");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("drops a line from the summary as that field is corrected", () => {
    render(<GuestOrderLinkRequest />);
    fireEvent.click(screen.getByRole("button", { name: "Email me a new link" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "grace@example.com" },
    });
    const summary = screen.getByRole("alert");
    expect(summary.textContent).not.toContain("Enter the email address");
    expect(summary.textContent).toContain("Enter the order reference");
  });
});
