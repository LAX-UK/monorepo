import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserProfilePanel } from "./admin-user-profile-panel";

const unavailableUser = {
  id: "u1",
  email: "client@example.com",
  name: "Client",
  role: "client",
  staffRole: null,
  signupPersona: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  suspendedAt: null,
  suspendedReason: null,
  image: null,
  mobile: null,
  mobileCountry: null,
  dateOfBirth: null,
  emailVerified: true,
  emailStatus: "ok",
  emailStatusChangedAt: null,
  kycStatus: "approved",
  kycVerifiedAt: null,
  kycRetryCount: 0,
  amlHoldStatus: null,
  amlHoldReason: null,
  amlHoldAt: null,
  deletionRequestedAt: null,
  currentKycSessionId: null,
  pendingNewEmail: null,
  emailChangeExpiresAt: null,
  securityStatusAvailable: false,
  twoFactorEnabled: false,
} as unknown as AdminUserDetailPayload;

describe("AdminUserProfilePanel", () => {
  it("does not label 2FA disabled when Identity is unavailable", () => {
    render(<AdminUserProfilePanel user={unavailableUser} />);

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
  });
});
