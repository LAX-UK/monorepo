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

const CLIENT = { id: "u1", email: "a@b.test", name: "A", role: "client" };

/** The API as the sign-in sees it: who the person is, and the answer to the restore. */
function mockApi(restore: Response | (() => Promise<Response>), me: object = CLIENT): void {
  fetchApi.mockImplementation(async (url: string) => {
    if (url.endsWith("/users/me")) return new Response(JSON.stringify({ data: me }));
    return typeof restore === "function" ? restore() : restore.clone();
  });
}

const { applySignInRestore, planSignInRestore } = await import("./sign-in-restore.server");

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const PERSONAL_ID = "11111111-1111-4111-8111-111111111111";

/** The call to the restore endpoint (the identity lookup comes before it). */
function restoreCall(): [string, RequestInit] {
  const call = fetchApi.mock.calls.find(([url]) => String(url).includes("remembered-account"));
  return call as [string, RequestInit];
}

function answer(data: unknown): Response {
  return new Response(JSON.stringify({ data }));
}

describe("planSignInRestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceToken.mockResolvedValue({ token: "resource-token" });
  });

  it("asks the API as the new session and opens the account it chose", async () => {
    mockApi(answer({ accountId: ORG_ID, lostOrganisation: null }));

    const plan = await planSignInRestore({ sessionId: "session-1" });

    expect(plan?.accountId).toBe(ORG_ID);
    expect(resourceToken).toHaveBeenCalledWith("session-1", "bid-api", "bid.read bid.write");
    const [url, init] = restoreCall();
    expect(url).toBe("https://api.test/legal-entities/me/remembered-account/restore");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer resource-token");
    expect(headers.get("origin")).toBe("https://lax.bid");
    expect(JSON.parse(String(init.body))).toEqual({ candidateId: null });
  });

  it("never offers this browser's old account: a sign-in opens the profile's account", async () => {
    mockApi(answer({ accountId: PERSONAL_ID, lostOrganisation: null }));
    await planSignInRestore({ sessionId: "session-1" });
    expect(JSON.parse(String(restoreCall()[1].body))).toEqual({ candidateId: null });
  });

  it("carries the notice when the person was removed from the organisation", async () => {
    mockApi(
      answer({
        accountId: PERSONAL_ID,
        lostOrganisation: { id: ORG_ID, displayName: "Northbank Gallery" },
      }),
    );
    const plan = await planSignInRestore({ sessionId: "session-1" });
    expect(plan).toMatchObject({
      accountId: PERSONAL_ID,
      notice: { kind: "removed", organisationName: "Northbank Gallery" },
    });
  });

  it.each([429, 500, 503])("does not block sign-in when the API answers %s", async (status) => {
    mockApi(new Response("{}", { status }));
    await expect(planSignInRestore({ sessionId: "session-1" })).resolves.toBeNull();
  });

  it("does not block sign-in when the API is unreachable or no token can be had", async () => {
    fetchApi.mockRejectedValue(new TypeError("fetch failed"));
    await expect(planSignInRestore({ sessionId: "session-1" })).resolves.toBeNull();
    resourceToken.mockRejectedValue(new Error("no session"));
    await expect(planSignInRestore({ sessionId: "session-1" })).resolves.toBeNull();
  });

  it("restores nothing for a staff member, and asks the API nothing beyond who they are", async () => {
    mockApi(answer({ accountId: ORG_ID, lostOrganisation: null }), {
      ...CLIENT,
      role: "staff",
      staffRoles: ["admin"],
    });
    await expect(planSignInRestore({ sessionId: "session-1" })).resolves.toBeNull();
    expect(restoreCall()).toBeUndefined();
  });

  it("gives up at one deadline for the whole restore, even when the token never arrives", async () => {
    vi.useFakeTimers();
    try {
      resourceToken.mockReturnValue(new Promise(() => {}));
      const plan = planSignInRestore({ sessionId: "session-1" });
      let settled = false;
      void plan.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(2_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      await expect(plan).resolves.toBeNull();
      expect(fetchApi).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
    mockApi(answer({ accountId: ORG_ID, lostOrganisation: null }));
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
    mockApi(
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

  it("sends no candidate even when this browser holds another person's organisation", async () => {
    mockApi(answer({ accountId: PERSONAL_ID, lostOrganisation: null }));
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, {
      sessionId: "session-1",
      request: signInRequest(`lax_acting_legal_entity_id=${ORG_ID}`),
    });

    expect(JSON.parse(String(restoreCall()[1].body))).toEqual({ candidateId: null });
    expect(response.cookies.get("lax_acting_legal_entity_id")?.value).toBe(PERSONAL_ID);
    expect(response.cookies.get("lax_account_notice")).toBeUndefined();
  });

  it("removes the old account cookie when the API cannot answer", async () => {
    mockApi(new Response("{}", { status: 503 }));
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, {
      sessionId: "session-1",
      request: signInRequest(`lax_acting_legal_entity_id=${ORG_ID}`),
    });

    expect(response.cookies.get("lax_acting_legal_entity_id")?.value).toBe("");
    expect(response.headers.get("set-cookie") ?? "").toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("removes the old account cookie for a staff member", async () => {
    mockApi(answer({ accountId: ORG_ID, lostOrganisation: null }), {
      ...CLIENT,
      role: "staff",
      staffRoles: ["admin"],
    });
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, {
      sessionId: "session-1",
      request: signInRequest(`lax_acting_legal_entity_id=${ORG_ID}`),
    });

    expect(response.cookies.get("lax_acting_legal_entity_id")?.value).toBe("");
  });

  it("leaves a staff member's view as a client alone, without asking the API", async () => {
    const viewing = encodeActingContextCookie({ v: 1, e: ORG_ID, i: { sid: PERSONAL_ID } });
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, {
      sessionId: "session-1",
      request: signInRequest(`lax_acting_legal_entity_id=${viewing}`),
    });

    expect(fetchApi).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("writes nothing when there was no cookie and the API cannot answer", async () => {
    mockApi(new Response("{}", { status: 503 }));
    const response = NextResponse.redirect("https://lax.bid/auth/post-login");

    await applySignInRestore(response, { sessionId: "session-1", request: signInRequest() });

    expect(response.cookies.get("lax_acting_legal_entity_id")?.value ?? "").toBe("");
  });
});
