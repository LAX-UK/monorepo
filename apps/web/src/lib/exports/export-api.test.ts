import { beforeEach, describe, expect, it, vi } from "vitest";

const browserFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/http/hc-browser", () => ({
  browserApiBase: () => "http://api.test",
  browserFetch: (...args: unknown[]) => browserFetch(...args),
}));

const { ExportApiError, createExport } = await import("./export-api");

describe("createExport and a stale sign-in", () => {
  beforeEach(() => browserFetch.mockReset());

  it("throws an error that carries the step-up code", async () => {
    browserFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Recent sign-in required", code: "step_up_required" }),
    });
    const error = await createExport({ entityType: "users" } as never).catch((e) => e);
    expect(error).toBeInstanceOf(ExportApiError);
    expect((error as InstanceType<typeof ExportApiError>).code).toBe("step_up_required");
  });

  it("still throws a plain message for other failures", async () => {
    browserFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const error = await createExport({ entityType: "users" } as never).catch((e) => e);
    expect(error).toBeInstanceOf(ExportApiError);
    expect((error as InstanceType<typeof ExportApiError>).code).toBeUndefined();
    expect((error as Error).message).toBe("Export failed (500)");
  });
});
