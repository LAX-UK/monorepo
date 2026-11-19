import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { resetZohoTokenCacheForTests } from "./oauth-token-refresh.js";
import {
  ZOHO_CRM_USER_RETRY_MS,
  resetZohoCrmIntegrationUserForTests,
  zohoCrmIntegrationUserId,
} from "./zoho-crm-current-user.js";

const env = {
  ZOHO_CLIENT_ID: "id",
  ZOHO_CLIENT_SECRET: "secret",
  ZOHO_REFRESH_TOKEN: "refresh",
  ZOHO_ACCOUNTS_HOST: "https://accounts.zoho.eu",
  ZOHO_CRM_API_HOST: "https://www.zohoapis.eu",
} as WorkerEnv;

function respond(usersStatus: number, usersBody: unknown) {
  const fetchMock = vi.fn(async (input: URL | string) => {
    const url = String(input);
    if (url.includes("/oauth/v2/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
    }
    return new Response(JSON.stringify(usersBody), { status: usersStatus });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const userCalls = (fetchMock: ReturnType<typeof respond>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes("/crm/v8/users")).length;

describe("zohoCrmIntegrationUserId", () => {
  beforeEach(() => {
    resetZohoTokenCacheForTests();
    resetZohoCrmIntegrationUserForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks Zoho for the current user once and keeps the answer", async () => {
    const fetchMock = respond(200, { users: [{ id: "5000000000000011001" }] });
    expect(await zohoCrmIntegrationUserId(env)).toBe("5000000000000011001");
    expect(await zohoCrmIntegrationUserId(env)).toBe("5000000000000011001");
    expect(userCalls(fetchMock)).toBe(1);
    const [url] = fetchMock.mock.calls.find(([u]) => String(u).includes("/users")) ?? [];
    expect(String(url)).toContain("type=CurrentUser");
  });

  it("answers null without throwing when Zoho refuses, and waits before asking again", async () => {
    const fetchMock = respond(403, { code: "OAUTH_SCOPE_MISMATCH" });
    const onFailure = vi.fn();
    let now = 1_000_000;
    expect(await zohoCrmIntegrationUserId(env, onFailure, () => now)).toBeNull();
    expect(onFailure).toHaveBeenCalledWith(expect.stringContaining("zoho_current_user_failed_403"));
    expect(await zohoCrmIntegrationUserId(env, onFailure, () => now)).toBeNull();
    expect(userCalls(fetchMock)).toBe(1);
    now += ZOHO_CRM_USER_RETRY_MS;
    await zohoCrmIntegrationUserId(env, onFailure, () => now);
    expect(userCalls(fetchMock)).toBe(2);
  });
});
