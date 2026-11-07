import { beforeEach, describe, expect, it, vi } from "vitest";

const amlDecide = vi.hoisted(() => vi.fn());
const sofReopen = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({ adminCompliance: { amlDecide, sofReopen } }),
}));

const { amlDecideAction, sofReopenAction } = await import("./admin-compliance");

const stale = {
  ok: false,
  status: 403,
  message: "Recent sign-in required",
  body: { error: "Recent sign-in required", code: "step_up_required" },
};

describe("compliance decisions and a stale sign-in", () => {
  beforeEach(() => {
    amlDecide.mockReset();
    sofReopen.mockReset();
  });

  it("returns step_up_required for a decision so the page sends the person to sign in again", async () => {
    amlDecide.mockResolvedValue(stale);
    expect(await amlDecideAction({ screeningId: "s1", decision: "clear" })).toMatchObject({
      ok: false,
      status: 403,
      errorCode: "step_up_required",
    });
  });

  it("returns step_up_required for a reopen", async () => {
    sofReopen.mockResolvedValue(stale);
    expect(await sofReopenAction({ caseId: "c1" })).toMatchObject({
      ok: false,
      errorCode: "step_up_required",
    });
  });

  it("keeps other refusals as they were", async () => {
    amlDecide.mockResolvedValue({
      ok: false,
      status: 409,
      message: "x",
      body: { error: "aml_triage_required" },
    });
    const result = await amlDecideAction({ screeningId: "s1", decision: "clear" });
    expect(result).toMatchObject({ ok: false });
    expect((result as { errorCode?: string }).errorCode).toBeUndefined();
  });
});
