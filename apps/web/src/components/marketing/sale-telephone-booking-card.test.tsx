import {
  SaleTelephoneBookingCard,
  type SaleTelephoneBookingCardProps,
} from "@/components/marketing/sale-telephone-booking-card";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Counts fetches of the form's own chunk (react-hook-form, the controls and the schema). */
const chunk = vi.hoisted(() => ({ loads: 0 }));

vi.mock("@/components/marketing/sale-telephone-booking-panel", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/marketing/sale-telephone-booking-panel")
  >("@/components/marketing/sale-telephone-booking-panel");
  return {
    get SaleTelephoneBookingPanelForm() {
      chunk.loads += 1;
      return actual.SaleTelephoneBookingPanelForm;
    },
  };
});

const entity = {
  id: "6f1b3a0e-1b1e-4c52-9c47-2b5d0a9f1a11",
  displayName: "Robert",
  memberRole: "individual",
};

const eligible: SaleTelephoneBookingCardProps = {
  saleId: "sale-1",
  saleTitle: "Autumn Sale",
  loginNextPath: "/sales/autumn/sale-1",
  isAuthenticated: true,
  kycApproved: true,
  mobile: "+447700900123",
  phoneNumberVerified: true,
  mobileDisplay: "+44 7700 900123",
  buyerEntities: [entity],
  existingBooking: null,
};

function booking(status: TelephoneBookingSnapshot["status"]): TelephoneBookingSnapshot {
  return {
    id: "booking-1",
    saleId: "sale-1",
    status,
    lotIds: [],
    authorizedMax: null,
    buyerNotes: null,
    phoneE164: "+447700900123",
    limitIncreaseRequestedAt: null,
    limitIncreaseAmount: null,
    completedLotIds: [],
    createdAt: "2026-11-01T10:00:00.000Z",
    confirmedAt: null,
    updatedAt: "2026-11-01T10:00:00.000Z",
  };
}

/** Lets effects, the near-viewport check (no IntersectionObserver in jsdom: near at once) and any
 * dynamic import settle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

// Order matters: the ineligible cases run first, while the chunk has never been fetched.
describe("SaleTelephoneBookingCard: who downloads the form", () => {
  it.each<[string, Partial<SaleTelephoneBookingCardProps>]>([
    ["signed out", { isAuthenticated: false }],
    ["identity not verified", { kycApproved: false }],
    ["no mobile number", { mobile: null, mobileDisplay: null }],
    ["mobile not verified", { phoneNumberVerified: false }],
    ["no buyer profile", { buyerEntities: [] }],
    ["no buyer profile, organisations off", { buyerEntities: [], orgModuleEnabled: false }],
    ["an active booking", { existingBooking: booking("requested") }],
    ["a confirmed booking", { existingBooking: booking("confirmed") }],
  ])("never fetches the form for a visitor with %s", async (_, override) => {
    window.location.hash = "#telephone";
    const { container } = render(<SaleTelephoneBookingCard {...eligible} {...override} />);
    // Pointing at the section tab is the other trigger for the fetch.
    const tab = document.createElement("a");
    tab.href = "#telephone";
    document.body.append(tab);
    fireEvent.pointerOver(tab);
    await settle();

    expect(chunk.loads).toBe(0);
    expect(container.querySelector("[aria-busy]")).toBeNull();
    expect(screen.queryByRole("group", { name: "Telephone line request" })).toBeNull();
    tab.remove();
    window.location.hash = "";
  });

  it("fetches the form for an eligible visitor, and for one whose booking was cancelled", async () => {
    render(<SaleTelephoneBookingCard {...eligible} existingBooking={booking("cancelled")} />);
    expect(
      await screen.findByRole("button", { name: "Request telephone line" }),
    ).toBeInTheDocument();
    expect(chunk.loads).toBeGreaterThan(0);
  });
});

describe("SaleTelephoneBookingCard: typed input", () => {
  it("keeps what was typed when the card renders again and the section tab is pointed at", async () => {
    const { rerender } = render(<SaleTelephoneBookingCard {...eligible} />);
    const max = await screen.findByLabelText("Authorised maximum (optional)");
    fireEvent.change(max, { target: { value: "2500" } });
    const notes = screen.getByRole("textbox", { name: /notes/i });
    fireEvent.change(notes, { target: { value: "Call after lot 12" } });

    rerender(<SaleTelephoneBookingCard {...eligible} saleTitle="Autumn Sale (updated)" />);
    const tab = document.createElement("a");
    tab.href = "#telephone";
    document.body.append(tab);
    fireEvent.pointerOver(tab);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await settle();
    tab.remove();

    expect(screen.getByLabelText("Authorised maximum (optional)")).toBe(max);
    expect(max).toHaveValue("2500");
    expect(screen.getByRole("textbox", { name: /notes/i })).toHaveValue("Call after lot 12");
  });
});
