import { describe, expect, it, vi } from "vitest";
import { OrganizationOnboardingService } from "./organization-onboarding.service.js";

describe("OrganizationOnboardingService", () => {
  it("checkNameAvailability ignores organisation kind filter", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const service = new OrganizationOnboardingService(db as never);
    const result = await service.checkNameAvailability("Acme Gallery");
    expect(result.available).toBe(true);
  });

  it("createOrganization rejects when user exceeds org cap", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      }),
    };
    const service = new OrganizationOnboardingService(db as never);
    await expect(
      service.createOrganization("user-1", {
        displayName: "Fourth Org",
        subkind: "gallery",
      }),
    ).rejects.toThrow("organization_limit_reached");
  });
});
