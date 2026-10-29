import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const PERSONAL = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Lena Fischer",
  kind: "individual",
  subkind: "private_collector",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};
const ORG = {
  id: "22222222-2222-4222-8222-222222222222",
  displayName: "Northbank Gallery",
  kind: "organisation",
  subkind: "gallery",
  status: "approved",
  role: "admin",
  isPrimaryAdmin: false,
};

const cookieValues = new Map<string, string>();
const setCookie = vi.fn((name: string, value: string) => cookieValues.set(name, value));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => setCookie(name, value),
  })),
  headers: vi.fn(async () => new Headers({ host: "lax.bid" })),
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

const { GET, POST } = await import("./route");

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Retry-After": "0" },
  });
}

function hop(headers: Record<string, string>, to = ORG.id, next = "/organisation/members") {
  const params = new URLSearchParams({ to, next });
  return new Request(`https://lax.bid/switch-account?${params.toString()}`, { headers });
}

function post(headers: Record<string, string>, to = ORG.id, next = "/home") {
  return new Request("https://lax.bid/switch-account", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ to, next }).toString(),
  });
}

describe("/switch-account", () => {
  beforeEach(() => {
    cookieValues.clear();
    setCookie.mockClear();
    apiFetch.mockReset();
    cookieValues.set("lax_acting_legal_entity_id", PERSONAL.id);
    apiFetch.mockImplementation(async (path: string) =>
      path === "/legal-entities/me" ? json(200, { data: [PERSONAL, ORG] }) : json(200, {}),
    );
  });

  it("switches for a link the person followed on this site", async () => {
    const res = await GET(hop({ "sec-fetch-site": "same-origin" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/organisation/members");
    expect(cookieValues.get("lax_acting_legal_entity_id")).toBe(ORG.id);
  });

  it("asks first when the link came from another site, and changes nothing", async () => {
    const res = await GET(hop({ "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      `/switch-account/confirm?to=${ORG.id}&next=%2Forganisation%2Fmembers`,
    );
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("asks first when the browser sends no Fetch Metadata", async () => {
    const res = await GET(hop({}));
    expect(res.headers.get("location")).toMatch(/^\/switch-account\/confirm\?/);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("never changes anything for a prefetch", async () => {
    const res = await GET(hop({ "sec-fetch-site": "same-origin", "next-router-prefetch": "1" }));
    expect(res.status).toBe(204);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("shows the retry state when the accounts cannot be read, never the access page", async () => {
    apiFetch.mockImplementation(async () => json(429, { error: "Too many requests" }));
    const res = await GET(hop({ "sec-fetch-site": "same-origin" }));
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("/switch-account/unavailable?retry=")).toBe(true);
    expect(location).not.toContain("no-access");
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("switches on the confirm page's post", async () => {
    const res = await POST(post({ "sec-fetch-site": "same-origin", origin: "https://lax.bid" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/home");
    expect(cookieValues.get("lax_acting_legal_entity_id")).toBe(ORG.id);
  });

  it("refuses a post from another site", async () => {
    const res = await POST(
      post({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("judges a post without Fetch Metadata by its Origin", async () => {
    const refused = await POST(post({ origin: "https://evil.example" }));
    expect(refused.status).toBe(403);
    const allowed = await POST(post({ origin: "https://lax.bid" }));
    expect(allowed.status).toBe(303);
  });
});
