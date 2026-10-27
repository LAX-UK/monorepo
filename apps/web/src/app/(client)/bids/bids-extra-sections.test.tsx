import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const telephoneBookings = vi.fn();
const conditionReports = vi.fn();

vi.mock("@/lib/data/http/telephone-booking.server", () => ({
  getServerMyTelephoneBookings: () => telephoneBookings(),
}));

vi.mock("@/lib/data/http/condition-report.server", () => ({
  getServerMyConditionReportRequests: () => conditionReports(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/ui/status-chip", () => ({
  StatusChip: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { ConditionReportsSection, TelephoneBidsSection } from "./bids-extra-sections";

const booking = {
  id: "tb1",
  saleId: "s1",
  status: "confirmed",
  lotIds: ["a"],
  authorizedMax: "10000",
  buyerNotes: null,
  phoneE164: "+447700900123",
  limitIncreaseRequestedAt: null,
  limitIncreaseAmount: null,
  completedLotIds: [],
  createdAt: "2026-10-01T10:00:00Z",
  confirmedAt: null,
  updatedAt: "2026-10-01T10:00:00Z",
  saleTitle: "Autumn Evening Sale",
};

beforeEach(() => {
  telephoneBookings.mockReset();
  conditionReports.mockReset();
});

describe("TelephoneBidsSection", () => {
  it("renders nothing when the person has no telephone bookings", async () => {
    telephoneBookings.mockResolvedValue([]);
    expect(await TelephoneBidsSection()).toBeNull();
  });

  it("renders a section anchored for the old Telephone bids URL when there are bookings", async () => {
    telephoneBookings.mockResolvedValue([booking]);
    const { container } = render(await TelephoneBidsSection());
    expect(container.querySelector("#telephone-bids")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Telephone bids" })).toBeInTheDocument();
    expect(screen.getByText("Autumn Evening Sale")).toBeInTheDocument();
  });

  it("shows an error instead of hiding the section when the lookup fails", async () => {
    telephoneBookings.mockRejectedValue(new Error("boom"));
    render(await TelephoneBidsSection());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("ConditionReportsSection", () => {
  it("renders nothing when the person has no requests", async () => {
    conditionReports.mockResolvedValue({ items: [], total: 0 });
    expect(await ConditionReportsSection()).toBeNull();
  });

  it("renders a section anchored for the old Condition reports URL when there are requests", async () => {
    conditionReports.mockResolvedValue({
      items: [
        {
          id: "cr1",
          lotId: "lot-1",
          lotTitle: "Harbour at dusk",
          lotSlug: "harbour",
          lotNumber: 12,
          status: "completed",
          createdAt: "2026-10-01T10:00:00Z",
          responseNote: null,
          downloadUrl: null,
        },
      ],
      total: 1,
    });
    const { container } = render(await ConditionReportsSection());
    expect(container.querySelector("#condition-reports")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Condition reports" })).toBeInTheDocument();
  });
});
