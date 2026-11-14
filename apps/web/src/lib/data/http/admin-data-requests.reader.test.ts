import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const fetchAuthed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/http/authed-server-fetch", () => ({ authedServerFetch: fetchAuthed }));

const { getAdminDataRequestErasureHolds } = await import("./admin-data-requests.reader");

const FLAG = { reference: "DR-0004", reason: "end_unknown", heldUntil: null };

describe("getAdminDataRequestErasureHolds", () => {
  beforeEach(() => fetchAuthed.mockReset());

  it("returns the flags, or an empty list when nothing is held", async () => {
    fetchAuthed.mockResolvedValueOnce(Response.json({ data: { holds: [FLAG] } }));
    expect(await getAdminDataRequestErasureHolds()).toEqual([FLAG]);
    fetchAuthed.mockResolvedValueOnce(Response.json({ data: { holds: [] } }));
    expect(await getAdminDataRequestErasureHolds()).toEqual([]);
  });

  it("is null, not empty, when it could not read them", async () => {
    fetchAuthed.mockRejectedValueOnce(new Error("network"));
    expect(await getAdminDataRequestErasureHolds()).toBeNull();
    fetchAuthed.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    expect(await getAdminDataRequestErasureHolds()).toBeNull();
    fetchAuthed.mockResolvedValueOnce(new Response("no", { status: 403 }));
    expect(await getAdminDataRequestErasureHolds()).toBeNull();
    fetchAuthed.mockResolvedValueOnce(Response.json({ data: { nope: true } }));
    expect(await getAdminDataRequestErasureHolds()).toBeNull();
  });
});
