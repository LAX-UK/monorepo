import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAccounts } = vi.hoisted(() => ({ listAccounts: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    listAccounts,
  },
}));

vi.mock("@/lib/auth/api-base", () => ({
  apiBaseUrl: () => "https://api.test",
}));

import { useConnectedAccounts } from "./use-connected-accounts";

describe("useConnectedAccounts", () => {
  beforeEach(() => {
    listAccounts.mockReset();
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

  it("lists the linked providers and offers no way to link or unlink from here", async () => {
    const { result } = renderHook(() => useConnectedAccounts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.state.google?.providerId).toBe("google");
    expect(result.current.state.apple).toBeNull();
    // Linking and removing go through LAX Account's Security page and the issuer's hand-off.
    expect(result.current).not.toHaveProperty("linkSocial");
    expect(result.current).not.toHaveProperty("unlinkAccount");
  });
});
