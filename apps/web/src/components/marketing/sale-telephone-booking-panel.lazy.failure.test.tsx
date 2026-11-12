import { LazySaleTelephoneBookingPanelForm } from "@/components/marketing/sale-telephone-booking-panel.lazy";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** The form's chunk: refused while `fail` is set. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));

vi.mock("@/components/marketing/sale-telephone-booking-panel", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/marketing/sale-telephone-booking-panel")
  >("@/components/marketing/sale-telephone-booking-panel");
  return {
    get SaleTelephoneBookingPanelForm() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("chunk failed");
      return actual.SaleTelephoneBookingPanelForm;
    },
  };
});

const props = {
  saleId: "sale-1",
  buyerEntities: [
    { id: "6f1b3a0e-1b1e-4c52-9c47-2b5d0a9f1a11", displayName: "Robert", memberRole: "individual" },
  ],
  contactNumber: "+44 7700 900123",
  onBooked: vi.fn(),
};

// The tests run in order and share the module cache: two failures, then the form arrives.
describe("LazySaleTelephoneBookingPanelForm when the form cannot be fetched", () => {
  it("lays the message over the placeholder, so the card keeps its height, and announces it", async () => {
    render(<LazySaleTelephoneBookingPanelForm {...props} />);
    const box = screen.getByTestId("telephone-form-box");
    const placeholder = box.firstElementChild as HTMLElement;
    expect(placeholder).not.toHaveClass("invisible");
    const placeholderMarkup = placeholder.innerHTML;

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/did not load/i);

    // Same box: the placeholder is still there, unchanged but hidden, and the message shares its
    // grid cell instead of replacing it, so nothing below the card moves.
    expect(screen.getByTestId("telephone-form-box")).toBe(box);
    expect(box.firstElementChild).toBe(placeholder);
    expect(placeholder.innerHTML).toBe(placeholderMarkup);
    expect(placeholder).toHaveClass("invisible", "col-start-1", "row-start-1");
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(alert).toHaveClass("col-start-1", "row-start-1");
    expect(box).toHaveClass("grid");
    expect(box.parentElement).toHaveAttribute("aria-busy", "false");
  });

  it("keeps focus in the card on retry and returns it to Try again when it fails again", async () => {
    render(<LazySaleTelephoneBookingPanelForm {...props} />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(retry).toHaveAccessibleDescription(/did not load/i);
    const region = screen.getByRole("group", { name: "Telephone line request" });

    retry.focus();
    fireEvent.click(retry);
    expect(document.activeElement).toBe(region);

    const again = await screen.findByRole("button", { name: "Try again" });
    await waitFor(() => expect(document.activeElement).toBe(again));
  });

  it("shows the form after Try again once the chunk can be fetched", async () => {
    render(<LazySaleTelephoneBookingPanelForm {...props} />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    const loadsBefore = chunk.loads;
    chunk.fail = false;

    await act(async () => {
      fireEvent.click(retry);
    });

    expect(
      await screen.findByRole("button", { name: "Request telephone line" }),
    ).toBeInTheDocument();
    expect(chunk.loads).toBe(loadsBefore + 1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Telephone line request" }),
    );
  });
});
