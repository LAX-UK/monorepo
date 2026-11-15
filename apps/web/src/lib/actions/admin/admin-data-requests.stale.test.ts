import { manualRecord } from "@/lib/admin/data-requests/data-request.fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
const denyMock = vi.hoisted(() => vi.fn());
const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyMock(...args),
}));
vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: () => sessionMock(),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.server", () => ({
  isStaffStepUpResponse: async () => false,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { patchDataRequestAction } = await import("./admin-data-requests");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const entry = (actorName: string | null) => ({
  at: "2026-11-02T10:00:00.000Z",
  event: "data_request.notes_edited",
  actorName,
  device: null,
  detail: {},
});
const record = (timeline: unknown[]) => ({ ...manualRecord, timeline });

describe("a stale data request edit", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    denyMock.mockReset().mockResolvedValue(null);
    sessionMock.mockReset().mockResolvedValue({ name: "Alex Rowe" });
  });

  it("does not name the person themselves when their other tab made the last change", async () => {
    sessionMock.mockResolvedValue({ name: "Daniel Price" });
    fetchMock
      .mockResolvedValueOnce(json({ error: "stale_version" }, 409))
      .mockResolvedValueOnce(
        json({ data: record([entry("Sofia Okafor"), entry("Daniel Price")]) }),
      );
    const result = await patchDataRequestAction("DR-0012", { version: 3, notes: "Called them." });
    expect(result).toMatchObject({ ok: false, errorCode: "stale_version" });
    expect(result).not.toHaveProperty("meta");
  });

  it("names the person who changed the request, read from its history", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "stale_version" }, 409))
      .mockResolvedValueOnce(
        json({ data: record([entry("Sofia Okafor"), entry("Daniel Price")]) }),
      );
    const result = await patchDataRequestAction("DR-0012", { version: 3, notes: "Called them." });
    expect(result).toMatchObject({
      ok: false,
      errorCode: "stale_version",
      meta: { editor: "Daniel Price" },
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/admin/data-requests/DR-0012");
  });

  it("still reports the stale edit when the history cannot be read", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "stale_version" }, 409))
      .mockResolvedValueOnce(json({ error: "x" }, 503));
    const result = await patchDataRequestAction("DR-0012", { version: 3, notes: "Called them." });
    expect(result).toMatchObject({ ok: false, errorCode: "stale_version" });
    expect(result).not.toHaveProperty("meta");
  });

  it("does not look anything up for a refusal that is not stale", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "not_open" }, 409));
    await patchDataRequestAction("DR-0012", { version: 3, notes: "Called them." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
