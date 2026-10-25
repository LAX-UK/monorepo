import { SaleTelephoneBookingsTab } from "@/components/admin/sale-detail/tabs/telephone-bookings-tab";
import { useTelephoneBookingActions } from "@/components/admin/sale-detail/tabs/use-telephone-booking-actions";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import type { Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminTelephoneBookingResultAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
  recentReauthAttempt: () => false,
}));

function booking(overrides: Partial<AdminTelephoneBookingRow> = {}): AdminTelephoneBookingRow {
  return {
    id: "booking-1",
    saleId: "sale-1",
    userId: "user-1",
    buyerLegalEntityId: "le-1",
    phoneE164: "+442071234567",
    lotIds: [],
    authorizedMax: "5000.00",
    status: "requested",
    clerkUserId: null,
    notes: null,
    buyerNotes: null,
    approvedByUserId: null,
    completedLotIds: [],
    limitIncreaseRequestedAt: null,
    limitIncreaseAmount: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    confirmedAt: null,
    updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    userEmail: "ada@example.com",
    userName: "Ada Lovelace",
    buyerLegalEntityDisplayName: "Ada Lovelace",
    phoneDisplay: "020 7123 4567",
    ...overrides,
  };
}

const baseProps = {
  saleId: "sale-1",
  sale: { deliveryMode: "onsite" } as Sale,
  liveish: true,
  fetchError: null,
  actionError: null,
};

function Menu({ row }: { row: AdminTelephoneBookingRow }) {
  const { actionsFor } = useTelephoneBookingActions("sale-1");
  return (
    <ul>
      {actionsFor(row).map((action) => (
        <li key={action.id}>{action.label}</li>
      ))}
    </ul>
  );
}

const labels = () => screen.getAllByRole("listitem").map((item) => item.textContent);

describe("SaleTelephoneBookingsTab", () => {
  it("lists the bidder, their line and where it stands", () => {
    render(<SaleTelephoneBookingsTab {...baseProps} rows={[booking()]} />);

    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("020 7123 4567").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requested").length).toBeGreaterThan(0);
  });

  it("flags a request for a higher limit next to the status", () => {
    render(
      <SaleTelephoneBookingsTab
        {...baseProps}
        rows={[booking({ limitIncreaseRequestedAt: new Date("2026-06-02T09:00:00.000Z") })]}
      />,
    );

    expect(screen.getAllByText("Higher limit asked").length).toBeGreaterThan(0);
  });

  it("says what will appear when nobody has asked for a line", () => {
    render(<SaleTelephoneBookingsTab {...baseProps} rows={[]} />);

    expect(screen.getByText("No telephone bookings yet")).toBeInTheDocument();
  });

  it("shows a failed load as an error and a refused action as a notice", () => {
    render(
      <SaleTelephoneBookingsTab
        {...baseProps}
        rows={[]}
        fetchError="Timed out"
        actionError="Booking already cancelled"
      />,
    );

    expect(screen.getByText("Telephone bookings could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Booking already cancelled")).toBeInTheDocument();
  });
});

describe("useTelephoneBookingActions", () => {
  it("lets staff confirm, staff the line, close or cancel a requested booking", () => {
    render(<Menu row={booking()} />);

    expect(labels()).toEqual([
      "Confirm booking",
      "Assign clerk",
      "Edit notes",
      "Open client",
      "Close line",
      "Cancel booking",
    ]);
  });

  it("offers approval of a higher limit when the bidder asked", () => {
    render(
      <Menu
        row={booking({
          status: "confirmed",
          limitIncreaseRequestedAt: new Date("2026-06-02T09:00:00.000Z"),
          limitIncreaseAmount: "8000.00",
          clerkUserId: "clerk-1",
        })}
      />,
    );

    expect(labels()).toContain("Approve higher limit");
    expect(labels()).toContain("Change clerk");
  });

  it("leaves only notes and the client once a booking is closed", () => {
    render(<Menu row={booking({ status: "cancelled" })} />);

    expect(labels()).toEqual(["Edit notes", "Open client"]);
  });
});
