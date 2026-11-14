import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const loadTeamScope = vi.fn();
const fetcher = vi.fn();

vi.mock("@/lib/data/http/session.reader", () => ({
  getServerSessionUser: () => getUser(),
}));
vi.mock("@/lib/organisation-team/team-data.server", () => ({
  loadTeamScope: (...args: unknown[]) => loadTeamScope(...args),
}));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => fetcher(...args),
}));

import { GET } from "./route";

const call = () =>
  GET(new Request("https://lax.test/organisation/documents/agreements/sub-1"), {
    params: Promise.resolve({ submissionId: "sub-1" }),
  });

describe("GET /organisation/documents/agreements/[submissionId]", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ id: "user-1" });
    loadTeamScope.mockReset().mockResolvedValue({ acting: { id: "org-1" } });
    fetcher.mockReset();
  });

  it("passes the PDF through for the organisation in use, never cached", async () => {
    fetcher.mockResolvedValue(new Response("%PDF-test"));
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetcher.mock.calls[0]?.[1].headers).toMatchObject({ "x-legal-entity-id": "org-1" });
  });

  it("answers an API refusal exactly like a missing agreement, not as an outage", async () => {
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    const refused = await call();
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const missing = await call();
    expect(refused.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await refused.json()).toEqual(await missing.json());
  });

  it("answers a failed API as unavailable", async () => {
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect((await call()).status).toBe(503);
    fetcher.mockRejectedValueOnce(new Error("down"));
    expect((await call()).status).toBe(503);
  });

  it("needs a signed-in member", async () => {
    getUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
