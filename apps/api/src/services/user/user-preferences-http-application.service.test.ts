import { describe, expect, it, vi } from "vitest";
import { UserPreferencesHttpApplicationService } from "./user-preferences-http-application.service.js";

describe("UserPreferencesHttpApplicationService", () => {
  it("upserts bidding preference patch without requiring full notification row shape", async () => {
    const upsert = vi.fn().mockResolvedValue({ userId: "u1", outbidPush: true });
    const svc = new UserPreferencesHttpApplicationService({
      vapidPublicKey: null,
      pushSubscriptionRepository: {} as never,
      notificationPreferenceRepository: { getForUser: vi.fn(), upsert } as never,
      uiPreferenceService: {} as never,
    });

    const response = await svc.patchBiddingPreferences({
      userId: "u1",
      body: { outbidPush: true, defaultMaxBidAmount: "1000" },
    });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith("u1", { outbidPush: true });
  });
});
