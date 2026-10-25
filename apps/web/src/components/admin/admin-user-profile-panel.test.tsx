import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserProfilePanel } from "./admin-user-profile-panel";

const user: AdminUserDetailPayload = {
  id: "user_1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  role: "client",
  staffRole: null,
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-13T10:00:00.000Z",
  suspendedAt: null,
  image: null,
  mobile: null,
  mobileCountry: null,
  emailVerified: false,
  emailStatus: "bounced",
  signupPersona: "individual",
  twoFactorEnabled: false,
  kycStatus: "unverified",
  kycVerifiedAt: null,
  kycRetryCount: 2,
  deletionRequestedAt: null,
  securityStatusAvailable: true,
  suspendedReason: null,
  dateOfBirth: null,
  emailStatusChangedAt: null,
  pendingNewEmail: null,
  emailChangeExpiresAt: null,
  currentKycSessionId: "veriff-session-1",
  amlHoldStatus: null,
  amlHoldReason: null,
  amlHoldAt: null,
};

const renderPanel = (value: AdminUserDetailPayload) =>
  render(
    <TooltipProvider>
      <AdminUserProfilePanel user={value} />
    </TooltipProvider>,
  );

describe("AdminUserProfilePanel", () => {
  it("reads identity, email and delivery in words, never stored values", () => {
    renderPanel(user);

    const security = screen.getByRole("region", { name: "Security and verification" });
    expect(
      within(security).getByText("Not verified", { selector: "span span" }),
    ).toBeInTheDocument();
    expect(within(security).getByText("Bounced")).toBeInTheDocument();
    expect(within(security).getByText("Off")).toBeInTheDocument();
    expect(screen.queryByText(/unverified/i)).toBeNull();
  });

  it("shows IDs in full as copyable facts", () => {
    renderPanel(user);

    expect(screen.getByText("user_1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy user id" })).toBeInTheDocument();
    expect(screen.getByText("veriff-session-1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy current identity session id" }),
    ).toBeInTheDocument();
  });

  it("leaves identity facts out for a staff member", () => {
    renderPanel({ ...user, role: "staff", staffRole: "finance_ops" });

    const security = screen.getByRole("region", { name: "Security" });
    expect(within(security).queryByText("Identity")).toBeNull();
    expect(screen.getByText("Finance")).toBeInTheDocument();
  });
});
