import { describe, expect, it, vi } from "vitest";
import {
  UserProfileHttpApplicationService,
  type UserProfileHttpDeps,
} from "./user-profile-http-application.service.js";

function serviceFor(profile: { role: string; staffRole: string | null }) {
  const deps = {
    profileService: {
      getProfile: vi.fn().mockResolvedValue({
        id: "u1",
        email: "u1@example.com",
        name: "U",
        image: null,
        termsAcceptedAt: null,
        ...profile,
      }),
    },
    addressService: {},
    uiPreferenceService: { getForUser: vi.fn().mockResolvedValue(null) },
    mediaUrlResolver: { resolve: vi.fn().mockResolvedValue(null) },
  } as unknown as UserProfileHttpDeps;
  return new UserProfileHttpApplicationService(deps);
}

type MeBody = { data: { staffRole: string | null; staffRoles: string[]; capabilities: string[] } };

describe("GET /users/me", () => {
  it("returns the session's roles in force and the capabilities they add up to", async () => {
    const res = await serviceFor({ role: "staff", staffRole: "specialist" }).getMe({
      userId: "u1",
      staffRoles: ["specialist", "client_services"],
    });

    const { data } = res.body as MeBody;
    expect(data.staffRole).toBe("specialist");
    expect(data.staffRoles).toEqual(["specialist", "client_services"]);
    expect(data.capabilities).toEqual(
      expect.arrayContaining(["specialist.appraise", "bids.read", "client.read"]),
    );
    expect(data.capabilities).not.toContain("bid.place");
  });

  it("gives clients their fixed capabilities and no staff roles", async () => {
    const res = await serviceFor({ role: "client", staffRole: null }).getMe({
      userId: "u1",
      staffRoles: undefined,
    });

    const { data } = res.body as MeBody;
    expect(data.staffRoles).toEqual([]);
    expect(data.capabilities).toEqual(["bid.place", "client.submit"]);
  });
});
