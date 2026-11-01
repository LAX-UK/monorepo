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

vi.mock("@/lib/data/sale-titles.server", () => ({ resolveSaleTitles: async () => ({}) }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("£10,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Autumn Evening Sale/ })).toHaveAttribute(
      "href",
      "/bids/telephone/tb1",
    );
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
          status: "fulfilled",
          createdAt: "2026-10-01T10:00:00Z",
          responseNote: null,
          downloadUrl: "https://files.example/report.pdf",
        },
      ],
      total: 1,
    });
    const { container } = render(await ConditionReportsSection());
    expect(container.querySelector("#condition-reports")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Condition reports" })).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download the condition report for Harbour at dusk" }),
    ).toHaveAttribute("href", "https://files.example/report.pdf");
  });

  it("shows the list error with Try again when the lookup fails", async () => {
    conditionReports.mockRejectedValue(new Error("boom"));
    render(await ConditionReportsSection());
    expect(screen.getByRole("heading", { name: "Condition reports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
