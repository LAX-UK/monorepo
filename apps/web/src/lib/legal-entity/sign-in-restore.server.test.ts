import { encodeActingContextCookie } from "@auction/types";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const resourceToken = vi.fn();
vi.mock("@/lib/bff/token-service.server", () => ({
  BidBffTokenService: class {
    resourceToken = resourceToken;
  },
}));
vi.mock("@/lib/bff/config.server", () => ({ BID_API_AUDIENCE: "bid-api" }));
vi.mock("@/lib/data/http/hc-server", () => ({ getServerApiBase: () => "https://api.test" }));
vi.mock("@/lib/data/http/server-request-headers", () => ({
  deriveSsrOrigin: async () => "https://lax.bid",
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const fetchApi = vi.fn();
vi.stubGlobal("fetch", fetchApi);

const { applySignInRestore, planSignInRestore } = await import("./sign-in-restore.server");

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const PERSONAL_ID = "11111111-1111-4111-8111-111111111111";

function answer(data: unknown): Response {
  return new Response(JSON.stringify({ data }));
}

describe("planSignInRestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceToken.mockResolvedValue({ token: "resource-token" });
  });

  it("asks the API as the new session and opens the account it chose", async () => {
    fetchApi.mockResolvedValue(answer({ accountId: ORG_ID, lostOrganisation: null }));

    const plan = await planSignInRestore({ sessionId: "session-1", actingCookie: undefined });

    expect(plan?.switchTo?.accountId).toBe(ORG_ID);
    expect(resourceToken).toHaveBeenCalledWith("session-1", "bid-api", "bid.read bid.write");
    const [url, init] = fetchApi.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/legal-entities/me/remembered-account/restore");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer resource-token");
    expect(headers.get("origin")).toBe("https://lax.bid");
    expect(JSON.parse(String(init.body))).toEqual({ candidateId: null });
  });

  it("offers the account this browser used last as the candidate", async () => {
    fetchApi.mockResolvedValue(answer({ accountId: ORG_ID, lostOrganisation: null }));
    await planSignInRestore({ sessionId: "session-1", actingCookie: ORG_ID });
    expect(JSON.parse(String((fetchApi.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      candidateId: ORG_ID,
    });
  });

  it("carries the notice when the person was removed from the organisation", async () => {
    fetchApi.mockResolvedValue(
      answer({
        accountId: PERSONAL_ID,
        lostOrganisation: { id: ORG_ID, displayName: "Northbank Gallery" },
      }),
    );
    const plan = await planSignInRestore({ sessionId: "session-1", actingCookie: ORG_ID });
    expect(plan?.switchTo).toMatchObject({
      accountId: PERSONAL_ID,
      notice: { kind: "removed", organisationName: "Northbank Gallery" },
    });
  });

  it.each([429, 500, 503])("does not block sign-in when the API answers %s", async (status) => {
    fetchApi.mockResolvedValue(new Response("{}", { status }));
    await expect(
      planSignInRestore({ sessionId: "session-1", actingCookie: undefined }),
    ).resolves.toBeNull();
  });

  it("does not block sign-in when the API is unreachable or no token can be had", async () => {
    fetchApi.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      planSignInRestore({ sessionId: "session-1", actingCookie: undefined }),
    ).resolves.toBeNull();
    resourceToken.mockRejectedValue(new Error("no session"));
    await expect(
      planSignInRestore({ sessionId: "session-1", actingCookie: undefined }),
    ).resolves.toBeNull();
  });

  it("leaves a staff member's view as a client alone", async () => {
    const viewing = encodeActingContextCookie({ v: 1, e: ORG_ID, i: { sid: PERSONAL_ID } });
    await expect(
      planSignInRestore({ sessionId: "session-1", actingCookie: viewing }),
    ).resolves.toBeNull();
    expect(fetchApi).not.toHaveBeenCalled();
  });
});

describe("applySignInRestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceToken.mockResolvedValue({ token: "resource-token" });
  });

  function signInRequest(cookie?: string): NextRequest {
    return new NextRequest("https://lax.bid/api/auth/callback/lax-bid-web", {
      headers: cookie ? { cookie } : {},
    });
  }

  it("writes the account cookie with the same flags the switch uses", async () => {
    fetchApi.mockResolvedValue(answer({ accountId: ORG_ID, lostOrganisation: null }));
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, { sessionId: "session-1", request: signInRequest() });

    const cookie = response.cookies.get("lax_acting_legal_entity_id");
    expect(cookie?.value).toBe(ORG_ID);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/Path=\//i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).not.toMatch(/HttpOnly/i);
  });

  it("writes the removed-from-organisation notice beside it", async () => {
    fetchApi.mockResolvedValue(
      answer({
        accountId: PERSONAL_ID,
        lostOrganisation: { id: ORG_ID, displayName: "Northbank Gallery" },
      }),
    );
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, {
      sessionId: "session-1",
      request: signInRequest(`lax_acting_legal_entity_id=${ORG_ID}`),
    });

    expect(response.cookies.get("lax_acting_legal_entity_id")?.value).toBe(PERSONAL_ID);
    expect(response.cookies.get("lax_account_notice")).toBeDefined();
  });

  it("writes nothing when the API cannot answer", async () => {
    fetchApi.mockResolvedValue(new Response("{}", { status: 503 }));
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, { sessionId: "session-1", request: signInRequest() });

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
