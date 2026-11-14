import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The form's chunk. Each fetch is held until the test settles it, so what the card shows while a
 * fetch is pending is observable, and nothing depends on how fast a promise settles.
 */
const chunk = vi.hoisted(() => ({
  loads: 0,
  pending: [] as Array<{ resolve: () => void; reject: () => void }>,
}));

vi.mock("@/components/marketing/sale-telephone-booking-panel", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/marketing/sale-telephone-booking-panel")
  >("@/components/marketing/sale-telephone-booking-panel");
  return {
    // Read once per fetch; the loader resolves to whatever this returns, promise included.
    get SaleTelephoneBookingPanelForm() {
      chunk.loads += 1;
      return new Promise((resolve, reject) => {
        chunk.pending.push({
          resolve: () => resolve(actual.SaleTelephoneBookingPanelForm),
          reject: () => reject(new Error("chunk failed")),
        });
      });
    },
  };
});

/** Settles the oldest held fetch once it has started. */
const settle = async (outcome: "resolve" | "reject") => {
  await waitFor(() => expect(chunk.pending.length).toBeGreaterThan(0));
  await act(async () => {
    chunk.pending.shift()?.[outcome]();
  });
};

/** A fresh copy of the component, so a form that arrived in one test is not remembered by the next. */
const freshLazyForm = async () => {
  vi.resetModules();
  const { LazySaleTelephoneBookingPanelForm } = await import(
    "@/components/marketing/sale-telephone-booking-panel.lazy"
  );
  return LazySaleTelephoneBookingPanelForm;
};

beforeEach(() => {
  chunk.loads = 0;
  chunk.pending.length = 0;
});

const props = {
  saleId: "sale-1",
  buyerEntities: [
    { id: "6f1b3a0e-1b1e-4c52-9c47-2b5d0a9f1a11", displayName: "Robert", memberRole: "individual" },
  ],
  contactNumber: "+44 7700 900123",
  onBooked: vi.fn(),
};

describe("LazySaleTelephoneBookingPanelForm when the form cannot be fetched", () => {
  it("lays the message over the placeholder, so the card keeps its height, and announces it", async () => {
    const LazyForm = await freshLazyForm();
    render(<LazyForm {...props} />);
    const box = screen.getByTestId("telephone-form-box");
    const placeholder = box.firstElementChild as HTMLElement;
    expect(placeholder).not.toHaveClass("invisible");
    const placeholderMarkup = placeholder.innerHTML;

    await settle("reject");
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
    const LazyForm = await freshLazyForm();
    render(<LazyForm {...props} />);
    await settle("reject");
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(retry).toHaveAccessibleDescription(/did not load/i);
    const region = screen.getByRole("group", { name: "Telephone line request" });

    retry.focus();
    fireEvent.click(retry);
    // The retry's fetch is held, so this is the state while it is pending.
    await waitFor(() => expect(document.activeElement).toBe(region));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await settle("reject");
    const again = await screen.findByRole("button", { name: "Try again" });
    await waitFor(() => expect(document.activeElement).toBe(again));
  });

  it("shows the form after Try again once the chunk can be fetched", async () => {
    const LazyForm = await freshLazyForm();
    render(<LazyForm {...props} />);
    await settle("reject");
    const retry = await screen.findByRole("button", { name: "Try again" });
    const loadsBefore = chunk.loads;

    fireEvent.click(retry);
    await settle("resolve");

    expect(
      await screen.findByRole("button", { name: "Request telephone line" }),
    ).toBeInTheDocument();
    expect(chunk.loads).toBe(loadsBefore + 1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("group", { name: "Telephone line request" }),
      ),
    );
  });
});
