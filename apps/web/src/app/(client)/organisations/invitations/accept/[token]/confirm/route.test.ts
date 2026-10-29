import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const setCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
    set: (name: string, value: string) => setCookie(name, value),
  })),
}));

vi.mock("@/lib/bff/config.server", () => ({
  bffConfig: () => ({ publicOrigin: "https://lax.bid" }),
}));

vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: async () => ({ id: "user-1", role: "client", staffRoles: [] }),
}));

const apiFetch = vi.fn();
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => apiFetch(...args),
}));

const { POST } = await import("./route");

const TOKEN = "invitation-token-123";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const PAGE = `/organisations/invitations/accept/${TOKEN}`;

function accept(headers: Record<string, string> = { "sec-fetch-site": "same-origin" }) {
  return POST(new Request(`https://lax.bid${PAGE}/confirm`, { method: "POST", headers }), {
    params: Promise.resolve({ token: TOKEN }),
  });
}

describe("POST invitation accept", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("accepts, then opens the organisation's Home in it and remembers it", async () => {
    apiFetch.mockImplementation(async (path: string) =>
      path === "/legal-entities/invitations/accept"
        ? new Response(JSON.stringify({ data: { legalEntityId: ORG_ID } }), { status: 201 })
        : new Response("{}"),
    );
    const res = await accept();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/home");
    expect(setCookie).toHaveBeenCalledWith("lax_acting_legal_entity_id", ORG_ID);
    expect(apiFetch).toHaveBeenCalledWith(
      "/legal-entities/me/remembered-account",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(apiFetch).toHaveBeenCalledWith(
      "/legal-entities/invitations/accept",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ token: TOKEN }) }),
    );
  });

  it("goes back to the page for a refusal, which reads the invitation again", async () => {
    apiFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "already_a_member" }), { status: 409 }),
    );
    const res = await accept();
    expect(res.headers.get("location")).toBe(PAGE);
  });

  it("asks to try again when the API could not answer", async () => {
    apiFetch.mockResolvedValue(new Response("{}", { status: 503 }));
    const res = await accept();
    expect(res.headers.get("location")).toBe(`${PAGE}?error=unavailable`);
  });

  it("refuses a post from another site without accepting anything", async () => {
    const res = await accept({ "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
