import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerMyStaffTools } from "./staff-tools.server";

const { authedServerFetch } = vi.hoisted(() => ({ authedServerFetch: vi.fn() }));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({ authedServerFetch }));

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("getServerMyStaffTools", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns the tools the Bid API lists", async () => {
    authedServerFetch.mockResolvedValue(answer({ data: { tools: ["bid-admin", "lax-admin"] } }));

    expect(await getServerMyStaffTools()).toEqual(["bid-admin", "lax-admin"]);
    expect(authedServerFetch).toHaveBeenCalledWith("/admin/staff/my-tools", {
      cache: "no-store",
    });
  });

  it("fails closed on an error status, a bad body or a network failure", async () => {
    authedServerFetch.mockResolvedValueOnce(answer({ error: "boom" }, 503));
    expect(await getServerMyStaffTools()).toEqual([]);

    authedServerFetch.mockResolvedValueOnce(answer({ data: { tools: ["vault-admin"] } }));
    expect(await getServerMyStaffTools()).toEqual([]);

    authedServerFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getServerMyStaffTools()).toEqual([]);
  });
});
