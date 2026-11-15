import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const detail = vi.fn();

vi.mock("@/lib/telephone/telephone-booking-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telephone/telephone-booking-api")>()),
  fetchTelephoneBookingDetail: (...args: unknown[]) => detail(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { TelephoneBidDetailContent } from "./telephone-bid-detail-content";

describe("TelephoneBidDetailContent detail labels", () => {
  it("reads in the workspace label style: sentence case, no tracking", async () => {
    detail.mockResolvedValue({
      kind: "found",
      booking: {
        id: "booking-1",
        status: "completed",
        phoneE164: "+447700900123",
        authorizedMax: null,
        limitIncreaseRequestedAt: null,
        limitIncreaseAmount: null,
        buyerNotes: "Call me at the lunch break",
        createdAt: "2026-01-01T10:00:00.000Z",
        saleTitle: "Spring sale",
        linkedBids: [],
      },
    });
    render(<TelephoneBidDetailContent bookingId="booking-1" />);
    for (const name of ["Phone", "Authorised max", "Your notes"]) {
      const term = await screen.findByText(name, { selector: "dt" });
      expect(term.className).not.toMatch(/uppercase|tracking-/);
    }
  });
});
