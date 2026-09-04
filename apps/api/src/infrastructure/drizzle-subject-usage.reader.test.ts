import { describe, expect, it, vi } from "vitest";
import { DrizzleSubjectUsageReader } from "./drizzle-subject-usage.reader.js";

describe("DrizzleSubjectUsageReader", () => {
  it("returns both product usage flags from one database query", async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ hasProductProfile: true, hasExternalLink: false }],
    });
    const reader = new DrizzleSubjectUsageReader({ execute } as never);

    await expect(reader.getSubjectUsage("subject-1")).resolves.toEqual({
      hasProductProfile: true,
      hasExternalLink: false,
    });
    expect(execute).toHaveBeenCalledOnce();
  });
});
