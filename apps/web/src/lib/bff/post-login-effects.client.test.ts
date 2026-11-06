import { beforeEach, describe, expect, it, vi } from "vitest";

const postAuthBroadcast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/auth-broadcast", () => ({ postAuthBroadcast }));
vi.mock("@/lib/analytics/events", () => ({ trackLogin: vi.fn() }));
vi.mock("@/lib/analytics/sell-funnel", () => ({ trackSellAuthHandoff: vi.fn() }));

import { runHostedPostLoginEffects } from "./post-login-effects.client";

describe("runHostedPostLoginEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "lax_acting_legal_entity_id=11111111-1111-4111-8111-111111111111; path=/";
  });

  it("keeps the account the sign-in callback chose, so the first page needs no restore", () => {
    runHostedPostLoginEffects({
      entryIntent: null,
      analyticsEnabled: false,
      marketingEnabled: false,
    });
    expect(document.cookie).toContain("lax_acting_legal_entity_id=11111111");
    expect(postAuthBroadcast).toHaveBeenCalledWith({ type: "signed-in" });
  });
});
