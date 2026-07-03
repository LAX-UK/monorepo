import { ExpectedGuestsPanel } from "@/components/admin/expected-guests-panel";
import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminSaleroomCheckInResultAction: vi.fn(),
  adminAssignPaddleResultAction: vi.fn(),
  adminClearPaddleResultAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

const segmentOptions = [
  { value: "full_evening", label: "Full evening" },
  { value: "auction_only", label: "Auction only" },
];

const baseGuest = (): AdminExpectedGuestRow => ({
  rsvpId: "rsvp-1",
  userId: "user-1",
  name: "Guest User",
  email: "guest@example.com",
  attendanceSegment: "full_evening",
  galaCheckedInAt: null,
  plusOne: 0,
  kycApproved: true,
  emailVerified: true,
  suspended: false,
  eligibleEntities: [
    {
      id: "le-1",
      displayName: "Guest User",
      role: "owner",
      kind: "individual",
      existingRegistration: null,
    },
  ],
  saleRegistration: null,
});

const panelProps = {
  saleId: "sale-1",
  eventSlug: "lax001",
  eventTitle: "Opening evening",
  segmentOptions,
};

describe("ExpectedGuestsPanel", () => {
  it("defaults hybrid guests to Mark present primary action", () => {
    render(<ExpectedGuestsPanel {...panelProps} deliveryMode="hybrid" items={[baseGuest()]} />);

    expect(screen.getByRole("button", { name: "Mark present" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Give paddle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign paddle" })).not.toBeInTheDocument();
  });

  it("defaults onsite guests to Assign paddle primary action", () => {
    render(<ExpectedGuestsPanel {...panelProps} deliveryMode="onsite" items={[baseGuest()]} />);

    expect(screen.getByRole("button", { name: "Assign paddle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark present" })).not.toBeInTheDocument();
  });

  it("shows desk check-in guidance when guest has no eligible entity", () => {
    render(
      <ExpectedGuestsPanel
        {...panelProps}
        deliveryMode="onsite"
        items={[{ ...baseGuest(), eligibleEntities: [] }]}
      />,
    );

    expect(screen.getByText(/Set up at desk/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open desk check-in/i })).toHaveAttribute(
      "href",
      "#check-in",
    );
  });

  it("links blocked guests to the client profile", () => {
    render(
      <ExpectedGuestsPanel
        {...panelProps}
        deliveryMode="onsite"
        items={[{ ...baseGuest(), kycApproved: false }]}
      />,
    );

    expect(screen.getByRole("link", { name: /Open client profile/i })).toHaveAttribute(
      "href",
      "/admin/clients/user-1",
    );
  });

  it("renders human segment labels instead of raw enum values", () => {
    render(
      <ExpectedGuestsPanel
        {...panelProps}
        deliveryMode="hybrid"
        items={[{ ...baseGuest(), attendanceSegment: "auction_only" }]}
      />,
    );

    expect(screen.getByText("Auction only")).toBeInTheDocument();
    expect(screen.queryByText("auction_only")).not.toBeInTheDocument();
  });

  it("shows reassign and clear controls for checked-in guests with a paddle", () => {
    render(
      <ExpectedGuestsPanel
        {...panelProps}
        deliveryMode="onsite"
        items={[
          {
            ...baseGuest(),
            saleRegistration: {
              registrationId: "reg-1",
              status: "checked_in",
              checkedInAt: "2026-06-18T18:05:00.000Z",
              paddleNumber: 142,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Paddle 142")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reassign" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
