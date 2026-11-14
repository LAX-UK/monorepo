import { ADMIN_SERVER_ERROR_MESSAGE } from "@/lib/admin/admin-route-error-message";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNLINKED_ORIGINALS_UNREACHABLE_MESSAGE,
  loadUnlinkedOriginalsPage,
} from "./load-unlinked-originals-page";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/http/authed-fetch.server", () => ({ authedServerFetch: fetchMock }));

const view = { blockPublishing: false, counts: { bid: 0, laxArt: 0 }, items: [] };

describe("loadUnlinkedOriginalsPage", () => {
  beforeEach(() => fetchMock.mockReset());

  it("shows the report when LAX Bid answers", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: view }));
    expect(await loadUnlinkedOriginalsPage()).toEqual({ view, loadError: null });
  });

  it("says LAX Bid did not answer when the request fails or a gateway times out", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await loadUnlinkedOriginalsPage()).toEqual({
      view: null,
      loadError: UNLINKED_ORIGINALS_UNREACHABLE_MESSAGE,
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 504 }));
    expect((await loadUnlinkedOriginalsPage()).loadError).toBe(
      UNLINKED_ORIGINALS_UNREACHABLE_MESSAGE,
    );
  });

  it("uses the admin server-error wording when LAX Bid answers with an error", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Internal Server Error" }, { status: 500 }),
    );
    expect(await loadUnlinkedOriginalsPage()).toEqual({
      view: null,
      loadError: ADMIN_SERVER_ERROR_MESSAGE,
    });
    fetchMock.mockResolvedValueOnce(Response.json({ data: { items: "not a list" } }));
    expect((await loadUnlinkedOriginalsPage()).loadError).toBe(ADMIN_SERVER_ERROR_MESSAGE);
  });
});
