import { ExpectedGuestsPanel } from "@/components/admin/expected-guests-panel";
import { useExpectedGuestActions } from "@/components/admin/expected-guests/use-expected-guest-actions";
import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import type { SaleDeliveryMode } from "@auction/types";
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

vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
  recentReauthAttempt: () => false,
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

function Menu({
  guest,
  deliveryMode,
}: { guest: AdminExpectedGuestRow; deliveryMode: SaleDeliveryMode }) {
  const { actionsFor } = useExpectedGuestActions("sale-1", deliveryMode);
  return (
    <ul>
      {actionsFor(guest).map((action) => (
        <li key={action.id} data-reason={action.disabledReason ?? ""} data-href={action.href ?? ""}>
          {action.label}
        </li>
      ))}
    </ul>
  );
}

const labels = () => screen.getAllByRole("listitem").map((item) => item.textContent);

describe("ExpectedGuestsPanel", () => {
  it("shows the guest, their attendance and where they stand", () => {
    render(<ExpectedGuestsPanel {...panelProps} deliveryMode="onsite" items={[baseGuest()]} />);

    expect(screen.getAllByText("Guest User").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Full evening").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not arrived").length).toBeGreaterThan(0);
  });

  it("renders human segment labels instead of raw enum values", () => {
    render(
      <ExpectedGuestsPanel
        {...panelProps}
        deliveryMode="hybrid"
        items={[{ ...baseGuest(), attendanceSegment: "auction_only" }]}
      />,
    );

    expect(screen.getAllByText("Auction only").length).toBeGreaterThan(0);
    expect(screen.queryByText("auction_only")).not.toBeInTheDocument();
  });

  it("names what blocks a guest's check-in", () => {
    render(
      <ExpectedGuestsPanel
        {...panelProps}
        deliveryMode="onsite"
        items={[{ ...baseGuest(), kycApproved: false }]}
      />,
    );

    expect(screen.getAllByText("Identity check incomplete").length).toBeGreaterThan(0);
  });

  it("shows the paddle a checked-in guest holds", () => {
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

    expect(screen.getAllByText("Paddle 142").length).toBeGreaterThan(0);
  });

  it("explains an empty search instead of showing a blank table", () => {
    render(<ExpectedGuestsPanel {...panelProps} deliveryMode="onsite" items={[]} />);

    expect(screen.getByText("No matching guests")).toBeInTheDocument();
  });
});

describe("useExpectedGuestActions", () => {
  it("offers mark present first on a hybrid sale, then a paddle", () => {
    render(<Menu guest={baseGuest()} deliveryMode="hybrid" />);

    expect(labels()).toEqual(["Mark present", "Give paddle", "Open client"]);
  });

  it("offers only a paddle on an onsite sale", () => {
    render(<Menu guest={baseGuest()} deliveryMode="onsite" />);

    expect(labels()).toEqual(["Assign paddle", "Open client"]);
  });

  it("holds check-in back, with the reason, while the account has issues", () => {
    render(<Menu guest={{ ...baseGuest(), kycApproved: false }} deliveryMode="onsite" />);

    const paddle = screen.getByText("Assign paddle");
    expect(paddle).toHaveAttribute("data-reason", "Resolve the account issues first");
  });

  it("points a guest with no buying entity to the desk check-in", () => {
    render(<Menu guest={{ ...baseGuest(), eligibleEntities: [] }} deliveryMode="onsite" />);

    expect(screen.getByText("Open desk check-in")).toHaveAttribute("data-href", "#check-in");
    expect(screen.getByText("Assign paddle")).toHaveAttribute(
      "data-reason",
      "Set the guest up at the desk first",
    );
  });

  it("offers reassign and clear for a guest who holds a paddle", () => {
    render(
      <Menu
        guest={{
          ...baseGuest(),
          saleRegistration: {
            registrationId: "reg-1",
            status: "checked_in",
            checkedInAt: "2026-06-18T18:05:00.000Z",
            paddleNumber: 142,
          },
        }}
        deliveryMode="onsite"
      />,
    );

    expect(labels()).toEqual(["Reassign paddle", "Clear paddle", "Open client"]);
  });
});
