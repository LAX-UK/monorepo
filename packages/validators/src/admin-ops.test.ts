import { describe, expect, it } from "vitest";
import { adminConveyorPipelineQuerySchema } from "./admin-ops.js";

describe("adminConveyorPipelineQuerySchema", () => {
  it("defaults limit to 200", () => {
    const r = adminConveyorPipelineQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(200);
  });

  it("coerces limit and rejects above max", () => {
    const r = adminConveyorPipelineQuerySchema.safeParse({ limit: "400" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(400);
    const hi = adminConveyorPipelineQuerySchema.safeParse({ limit: 501 });
    expect(hi.success).toBe(false);
  });
});
