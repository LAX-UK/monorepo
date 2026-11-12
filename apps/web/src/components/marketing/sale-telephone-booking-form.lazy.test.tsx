import { LazySaleTelephoneBookingForm } from "@/components/marketing/sale-telephone-booking-form.lazy";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const props = {
  saleId: "sale-1",
  buyerEntities: [
    { id: "6f1b3a0e-1b1e-4c52-9c47-2b5d0a9f1a11", displayName: "Robert", memberRole: "individual" },
  ],
  contactNumber: "+44 7700 900123",
  onBooked: vi.fn(),
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("LazySaleTelephoneBookingForm", () => {
  it("shows the note and a busy placeholder, and no form, until the card comes near", () => {
    class Quiet {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", Quiet);
    const { container } = render(<LazySaleTelephoneBookingForm {...props} />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/We will call \+44 7700 900123/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request telephone line" }),
    ).not.toBeInTheDocument();
  });

  it("loads the form once the card is near", async () => {
    const { container } = render(<LazySaleTelephoneBookingForm {...props} />);
    expect(
      await screen.findByRole("button", { name: "Request telephone line" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Authorised maximum (optional)")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "false");
  });
});

describe("LazySaleTelephoneBookingForm when the form cannot be fetched", () => {
  it("says so and offers a retry", async () => {
    vi.doMock("@/components/marketing/sale-telephone-booking-form", () => {
      throw new Error("chunk failed");
    });
    const { LazySaleTelephoneBookingForm: Lazy } = await import(
      "@/components/marketing/sale-telephone-booking-form.lazy"
    );
    render(<Lazy {...props} />);
    expect(await screen.findByText(/did not load/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/did not load/i)).toBeInTheDocument();
  });
});
