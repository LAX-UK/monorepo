import {
  IdentityRejectedError,
  IdentityUnavailableError,
  type OidcTokenResponse,
  type TokenEndpoint,
} from "@auction/identity-rp";
import { describe, expect, it, vi } from "vitest";
import { createMemorySessionStore } from "../infrastructure/memory-session-store";
import type { StaffSessionRecord } from "../ports/session-store";
import { revalidateAccountSession } from "./revalidate-account-session";

const NOW = 1_800_000_000_000;

function record(overrides: Partial<StaffSessionRecord> = {}): StaffSessionRecord {
  return {
    subject: "user-1",
    sid: "sid-1",
    idToken: "id-old",
    accessToken: "access-old",
    refreshToken: "refresh-old",
    accessTokenExpiresAtMs: NOW + 3_600_000,
    authTime: 1,
    acr: "",
    ...overrides,
  };
}

function endpoint(result: OidcTokenResponse | Error): TokenEndpoint & { calls: URLSearchParams[] } {
  const calls: URLSearchParams[] = [];
  return {
    calls,
    requestToken: vi.fn(async (body: URLSearchParams) => {
      calls.push(body);
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

async function run(stored: StaffSessionRecord, tokenEndpoint: TokenEndpoint) {
  const sessions = createMemorySessionStore();
  await sessions.save("sess", stored, 3600);
  const result = await revalidateAccountSession({
    sessionId: "sess",
    sessions,
    tokenEndpoint,
    sessionTtlSeconds: 3600,
    nowMs: () => NOW,
  });
  return { result, persisted: await sessions.get("sess") };
}

describe("revalidateAccountSession", () => {
  it("returns a fresh session without calling the issuer", async () => {
    const tokens = endpoint(new Error("unused"));
    const { result } = await run(record(), tokens);
    expect(result?.accessToken).toBe("access-old");
    expect(tokens.calls).toHaveLength(0);
  });

  it("refreshes an expired access token and persists the rotated tokens", async () => {
    const tokens = endpoint({
      access_token: "access-new",
      refresh_token: "refresh-new",
      id_token: "id-new",
      expires_in: 900,
      token_type: "Bearer",
    });
    const { result, persisted } = await run(record({ accessTokenExpiresAtMs: NOW - 1 }), tokens);
    expect(tokens.calls[0]?.get("grant_type")).toBe("refresh_token");
    expect(tokens.calls[0]?.get("refresh_token")).toBe("refresh-old");
    expect(result).toMatchObject({
      accessToken: "access-new",
      refreshToken: "refresh-new",
      idToken: "id-new",
      accessTokenExpiresAtMs: NOW + 900_000,
    });
    expect(persisted).toEqual(result);
  });

  it("ends the session when the issuer rejects the refresh", async () => {
    const tokens = endpoint(new IdentityRejectedError(400, "rejected", "invalid_grant"));
    const { result, persisted } = await run(record({ accessTokenExpiresAtMs: NOW - 1 }), tokens);
    expect(result).toBeNull();
    expect(persisted).toBeNull();
  });

  it("keeps the session when the issuer is unreachable", async () => {
    const tokens = endpoint(new IdentityUnavailableError("down"));
    const { result, persisted } = await run(record({ accessTokenExpiresAtMs: NOW - 1 }), tokens);
    expect(result?.accessToken).toBe("access-old");
    expect(persisted?.accessToken).toBe("access-old");
  });
});
