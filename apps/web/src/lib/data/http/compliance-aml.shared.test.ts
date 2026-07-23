import { describe, expect, it } from "vitest";
import { parseAdminAmlPageBody } from "./compliance-aml.shared";

describe("parseAdminAmlPageBody", () => {
  it("parses a valid AML list envelope", () => {
    const page = parseAdminAmlPageBody(
      {
        data: [],
        meta: {
          total: 3,
          limit: 50,
          offset: 0,
          summary: { total: 3, awaitingTriage: 2, triaged: 1, escalated: 0 },
        },
      },
      { limit: 50, offset: 0 },
    );
    expect(page.summary.awaitingTriage).toBe(2);
    expect(page.total).toBe(3);
  });

  it("rejects invalid summary buckets", () => {
    expect(() =>
      parseAdminAmlPageBody(
        {
          data: [],
          meta: {
            total: 3,
            summary: { total: 3, awaitingTriage: 1, triaged: 1, escalated: 0 },
          },
        },
        { limit: 50, offset: 0 },
      ),
    ).toThrow(/partition/);
  });

  it("rejects missing summary", () => {
    expect(() =>
      parseAdminAmlPageBody({ data: [], meta: { total: 0 } }, { limit: 50, offset: 0 }),
    ).toThrow(/Invalid AML list summary/);
  });
});
