import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAccounts, linkSocial } = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  linkSocial: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    listAccounts,
    linkSocial,
    unlinkAccount: vi.fn(),
  },
}));

vi.mock("@/lib/auth/api-base", () => ({
  apiBaseUrl: () => "https://api.test",
}));

import { useConnectedAccounts } from "./use-connected-accounts";

describe("useConnectedAccounts", () => {
  beforeEach(() => {
    listAccounts.mockReset();
    linkSocial.mockReset();
    listAccounts.mockResolvedValue({
      data: [
        {
          id: "1",
          providerId: "google",
          accountId: "g",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          scopes: [],
        },
      ],
      error: null,
    });
  });

  it("includes the linked provider in the OAuth callback URL", async () => {
    linkSocial.mockResolvedValue({ error: null });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "https://lax.bid" },
    });

    const { result } = renderHook(() => useConnectedAccounts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.linkSocial("google");

    expect(linkSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "https://lax.bid/dashboard/settings?tab=security&linked=google",
    });
  });
});
