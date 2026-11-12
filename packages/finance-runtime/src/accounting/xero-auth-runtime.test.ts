import type { IXeroConnectionRepository } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

const createXeroClientForOAuth = vi.hoisted(() => vi.fn());
vi.mock("./xero-client-factory.js", () => ({ createXeroClientForOAuth }));

import { proactiveRefreshXeroTokens } from "./xero-auth-runtime.js";

describe("proactiveRefreshXeroTokens without a usable sealing key", () => {
  it("never calls Xero when the stored tokens cannot be read", async () => {
    const connections = {
      findLatest: vi.fn().mockRejectedValue(new Error("xero_token_sealing_key_missing")),
      updateConnectionStatus: vi.fn(),
      updateTokens: vi.fn(),
    } as unknown as IXeroConnectionRepository;

    const result = await proactiveRefreshXeroTokens({
      env: { XERO_CLIENT_ID: "id", XERO_CLIENT_SECRET: "secret", XERO_REDIRECT_URI: "https://x" },
      connections,
      redis: {} as Redis,
    });

    expect(result).toEqual({ ok: false, reason: "xero_token_sealing_key_missing" });
    expect(createXeroClientForOAuth).not.toHaveBeenCalled();
    expect(connections.updateConnectionStatus).not.toHaveBeenCalled();
    expect(connections.updateTokens).not.toHaveBeenCalled();
  });
});
