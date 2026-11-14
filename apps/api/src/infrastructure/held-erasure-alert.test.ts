import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@auction/observability", () => ({ captureBackgroundError: capture }));

import { reportHeldErasureNeedsStaff } from "./held-erasure-alert.js";

describe("reportHeldErasureNeedsStaff", () => {
  beforeEach(() => capture.mockReset());

  it("reports the reference and the reason, and nothing else", () => {
    reportHeldErasureNeedsStaff("DR-0007", "end_unknown");
    expect(capture).toHaveBeenCalledWith("held-erasure", expect.any(Error), {
      extra: { reference: "DR-0007", reason: "end_unknown" },
    });
    expect((capture.mock.calls[0]?.[1] as Error).message).toBe(
      "A held erasure needs staff: end_unknown",
    );
  });
});
