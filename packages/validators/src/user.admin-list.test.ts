import { describe, expect, it } from "vitest";
import { adminUserListQuerySchema } from "./user.js";

describe("adminUserListQuerySchema", () => {
  it("accepts minimal query with defaults", () => {
    const r = adminUserListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(25);
      expect(r.data.sort).toBe("created_desc");
    }
  });

  it("parses comma-separated kycStatuses", () => {
    const r = adminUserListQuerySchema.safeParse({
      kycStatuses: "pending,approved",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.kycStatuses).toEqual(["pending", "approved"]);
    }
  });

  it("rejects invalid kycStatus", () => {
    const r = adminUserListQuerySchema.safeParse({ kycStatus: "bogus" });
    expect(r.success).toBe(false);
  });

  it("rejects createdFrom after createdTo", () => {
    const r = adminUserListQuerySchema.safeParse({
      createdFrom: "2026-02-01",
      createdTo: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  it("rejects suspended=1 with status=active", () => {
    const r = adminUserListQuerySchema.safeParse({ suspended: "1", status: "active" });
    expect(r.success).toBe(false);
  });
});
