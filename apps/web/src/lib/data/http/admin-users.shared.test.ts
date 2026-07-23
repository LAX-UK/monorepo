import { describe, expect, it } from "vitest";
import { parseAdminUserPageBody } from "./admin-users.shared";

describe("parseAdminUserPageBody", () => {
  it("parses standard list envelope with meta.summary", () => {
    const page = parseAdminUserPageBody(
      {
        data: [
          {
            id: "u1",
            email: "alice@example.com",
            name: "Alice",
            role: "client",
          },
        ],
        meta: {
          total: 1,
          limit: 25,
          offset: 0,
          summary: {
            total: 10,
            active: 8,
            suspended: 2,
            emailVerified: 7,
            kycVerified: 5,
          },
        },
      },
      { limit: 25, offset: 0, role: "client" },
    );

    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.email).toBe("alice@example.com");
    expect(page.total).toBe(1);
    expect(page.summary.total).toBe(10);
    expect(page.summary.active).toBe(8);
    expect(page.summary.kycVerified).toBe(5);
    expect(page.hasNextPage).toBe(false);
  });

  it("computes hasNextPage from offset and row count", () => {
    const page = parseAdminUserPageBody(
      {
        data: [{ id: "u1", email: "a@example.com", name: "A", role: "client" }],
        meta: {
          total: 40,
          limit: 25,
          offset: 0,
          summary: {
            total: 40,
            active: 30,
            suspended: 10,
            emailVerified: 25,
            kycVerified: 20,
          },
        },
      },
      { limit: 25, offset: 0, role: "client" },
    );

    expect(page.hasNextPage).toBe(true);
  });

  it("throws on invalid summary envelope", () => {
    expect(() =>
      parseAdminUserPageBody(
        {
          data: [],
          meta: { total: 1, limit: 25, offset: 0, summary: { total: "bad" } },
        },
        { limit: 25, offset: 0, role: "client" },
      ),
    ).toThrow(/Invalid users list summary/);
  });
});
