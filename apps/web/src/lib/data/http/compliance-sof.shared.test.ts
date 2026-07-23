import { describe, expect, it } from "vitest";
import { parseAdminSourceOfFundsPageBody } from "./compliance-sof.shared";

describe("parseAdminSourceOfFundsPageBody", () => {
  it("parses a valid SoF list envelope", () => {
    const page = parseAdminSourceOfFundsPageBody(
      {
        data: [],
        meta: {
          total: 5,
          limit: 100,
          offset: 0,
          summary: { total: 5, awaitingTriage: 3, triaged: 2 },
        },
      },
      { status: "pending", limit: 100, offset: 0 },
    );
    expect(page.summary.triaged).toBe(2);
    expect(page.total).toBe(5);
  });

  it("rejects summary totals that do not partition", () => {
    expect(() =>
      parseAdminSourceOfFundsPageBody(
        {
          data: [],
          meta: {
            total: 4,
            summary: { total: 4, awaitingTriage: 2, triaged: 1 },
          },
        },
        { status: "pending", limit: 100, offset: 0 },
      ),
    ).toThrow(/partition/);
  });
});
