import { describe, expect, it, vi } from "vitest";
import { ProfileService } from "./profile.service.js";

describe("ProfileService", () => {
  it("updates profile image to null and enqueues cleanup for previous owned image", async () => {
    const reader = {
      getProfile: vi.fn().mockResolvedValue({
        id: "u1",
        email: "u1@example.com",
        name: "User",
        image: "uploads/pending/avatar/u1/old.webp",
        role: "client",
        staffRole: null,
        emailVerified: true,
        emailStatus: "ok" as const,
        emailStatusChangedAt: null,
        pendingNewEmail: null,
        hasSeenActingContextTooltip: false,
        kycStatus: "unverified" as const,
        signupPersona: null,
        deletionRequestedAt: null,
        twoFactorEnabled: false,
      }),
    };
    const writer = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const cleanup = { enqueueRemoved: vi.fn().mockResolvedValue(undefined) };
    const service = new ProfileService(reader, writer, cleanup as never);

    await service.updateProfile("u1", { image: null });

    expect(writer.updateProfile).toHaveBeenCalledWith("u1", { image: null });
    expect(cleanup.enqueueRemoved).toHaveBeenCalledWith("uploads/pending/avatar/u1/old.webp", null);
  });

  it("does not read the previous profile when only the name changes", async () => {
    const reader = { getProfile: vi.fn() };
    const writer = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const cleanup = { enqueueRemoved: vi.fn() };
    const service = new ProfileService(reader, writer, cleanup as never);

    await service.updateProfile("u1", { name: "New Name" });

    expect(reader.getProfile).not.toHaveBeenCalled();
    expect(cleanup.enqueueRemoved).not.toHaveBeenCalled();
  });

  it("overlays authoritative security facts onto the local profile", async () => {
    const local = {
      id: "u1",
      email: "u1@example.com",
      name: "User",
      mobile: null,
      mobileCountry: null,
      phoneNumber: null,
      phoneNumberVerified: false,
      image: null,
      role: "client",
      staffRole: null,
      emailVerified: true,
      emailStatus: "ok" as const,
      emailStatusChangedAt: null,
      pendingNewEmail: null,
      hasSeenActingContextTooltip: false,
      kycStatus: "unverified" as const,
      signupPersona: null,
      deletionRequestedAt: null,
      twoFactorEnabled: false,
      suspended: false,
    };
    const identitySecurity = {
      readSecurityStatus: vi.fn().mockResolvedValue({
        twoFactorEnabled: true,
        phoneNumber: "+442012345678",
        phoneNumberVerified: true,
        pendingNewEmail: "next@example.com",
        emailChangeExpiresAt: null,
      }),
    };
    const service = new ProfileService(
      { getProfile: vi.fn().mockResolvedValue(local) },
      { updateProfile: vi.fn() },
      undefined,
      identitySecurity,
    );

    await expect(service.getProfile("u1")).resolves.toMatchObject({
      securityStatusAvailable: true,
      twoFactorEnabled: true,
      phoneNumber: "+442012345678",
      phoneNumberVerified: true,
      pendingNewEmail: "next@example.com",
    });
  });

  it.each([
    ["returns null", vi.fn().mockResolvedValue(null)],
    ["throws", vi.fn().mockRejectedValue(new Error("Identity unavailable"))],
  ])("keeps the local profile when Identity %s", async (_scenario, readSecurityStatus) => {
    const local = {
      id: "u1",
      email: "u1@example.com",
      name: "User",
      mobile: null,
      mobileCountry: null,
      phoneNumber: null,
      phoneNumberVerified: false,
      image: null,
      role: "client",
      staffRole: null,
      emailVerified: true,
      emailStatus: "ok" as const,
      emailStatusChangedAt: null,
      pendingNewEmail: null,
      hasSeenActingContextTooltip: false,
      kycStatus: "unverified" as const,
      signupPersona: null,
      deletionRequestedAt: null,
      twoFactorEnabled: false,
      suspended: false,
    };
    const service = new ProfileService(
      { getProfile: vi.fn().mockResolvedValue(local) },
      { updateProfile: vi.fn() },
      undefined,
      { readSecurityStatus },
    );

    await expect(service.getProfile("u1")).resolves.toMatchObject({
      id: "u1",
      securityStatusAvailable: false,
    });
  });

  it("returns null only when the local profile is absent", async () => {
    const readSecurityStatus = vi.fn();
    const service = new ProfileService(
      { getProfile: vi.fn().mockResolvedValue(null) },
      { updateProfile: vi.fn() },
      undefined,
      { readSecurityStatus },
    );

    await expect(service.getProfile("u1")).resolves.toBeNull();
    expect(readSecurityStatus).not.toHaveBeenCalled();
  });
});
