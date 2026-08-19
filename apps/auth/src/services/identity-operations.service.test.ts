import { describe, expect, it, vi } from "vitest";

const { publishIdentityProfileUpdated } = vi.hoisted(() => ({
  publishIdentityProfileUpdated: vi.fn(),
}));

vi.mock("./publish-identity-profile-updated.js", () => ({
  publishIdentityProfileUpdated,
}));

import { IdentityOperationsService, isCompensatableOrphan } from "./identity-operations.service.js";

describe("IdentityOperationsService boundary validation", () => {
  const productSubjectUsage = {
    hasProductProfile: vi.fn(),
    hasExternalLink: vi.fn(),
  };
  const service = new IdentityOperationsService(
    {} as never,
    { enqueue: vi.fn() } as never,
    productSubjectUsage,
    { publish: vi.fn() },
  );

  it("enforces the established setup-password policy before hashing or storage", async () => {
    await expect(service.setupPassword("subject", "short")).rejects.toMatchObject({
      code: "invalid_password_policy",
    });
  });

  it.each([new Date("invalid"), new Date(0)])(
    "rejects invalid email-change expiry before database access",
    async (expiresAt) => {
      await expect(
        service.startEmailChange("subject", "next@example.com", expiresAt),
      ).rejects.toMatchObject({ code: "invalid_expiry" });
    },
  );

  it("publishes only changed profile fields so name edits do not reset email delivery state", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "subject", name: "Updated Name" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const db = { update: vi.fn(() => ({ set })) };
    const identityEventPublisher = { publish: vi.fn() };
    const service = new IdentityOperationsService(
      db as never,
      { enqueue: vi.fn() } as never,
      productSubjectUsage,
      identityEventPublisher,
    );

    await service.updateSubjectProfile("subject", { name: "Updated Name" });

    expect(publishIdentityProfileUpdated).toHaveBeenCalledWith(identityEventPublisher, {
      subjectId: "subject",
      name: "Updated Name",
    });
  });
});

describe("isCompensatableOrphan", () => {
  const now = Date.parse("2026-08-10T00:15:00.000Z");

  it("allows only a recent credential-only subject with no product links", () => {
    expect(
      isCompensatableOrphan({
        createdAt: new Date("2026-08-10T00:05:00.000Z"),
        accountProviderIds: ["credential"],
        hasProductProfile: false,
        hasExternalLink: false,
        now,
      }),
    ).toBe(true);
  });

  it.each([
    { accountProviderIds: ["google"], hasProductProfile: false, hasExternalLink: false },
    { accountProviderIds: ["credential"], hasProductProfile: true, hasExternalLink: false },
    { accountProviderIds: ["credential"], hasProductProfile: false, hasExternalLink: true },
  ])("rejects linked or non-credential subjects", (input) => {
    expect(
      isCompensatableOrphan({
        createdAt: new Date("2026-08-10T00:05:00.000Z"),
        ...input,
        now,
      }),
    ).toBe(false);
  });
});
