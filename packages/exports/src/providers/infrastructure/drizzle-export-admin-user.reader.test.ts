import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleExportAdminUserReader } from "./drizzle-export-admin-user.reader.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DrizzleExportAdminUserReader", () => {
  it("uses one canonical predicate for alias-safe row and count queries", async () => {
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const updatedAt = new Date("2025-02-01T00:00:00.000Z");
    const projectedRow = {
      id: "identity-subject",
      email: "person@example.com",
      name: "Person",
      firstName: null,
      lastName: null,
      role: "client",
      staffRole: null,
      createdAt,
      updatedAt,
      suspendedAt: null,
      image: null,
      mobile: null,
      mobileCountry: null,
      emailVerified: false,
      emailStatus: "ok",
      signupPersona: null,
      kycStatus: "unverified",
      kycVerifiedAt: null,
      kycRetryCount: 0,
      deletionRequestedAt: null,
    };
    const countWhere = vi.fn().mockResolvedValue([{ n: 1 }]);
    const rowsWhere = vi.fn().mockResolvedValue([projectedRow]);
    const countLeftJoin = vi.fn().mockReturnValue({ where: countWhere });
    const rowsOffset = vi.fn().mockReturnValue({ where: rowsWhere });
    const rowsLimit = vi.fn().mockReturnValue({ offset: rowsOffset });
    const rowsOrderBy = vi.fn().mockReturnValue({ limit: rowsLimit });
    const rowsLeftJoin = vi.fn().mockReturnValue({ orderBy: rowsOrderBy });
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ leftJoin: countLeftJoin }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ leftJoin: rowsLeftJoin }) });
    const reader = new DrizzleExportAdminUserReader({ select } as never);

    const result = await reader.list({ limit: 25, offset: 0 });

    expect(countWhere).toHaveBeenCalledOnce();
    expect(rowsWhere).toHaveBeenCalledOnce();
    expect(countWhere.mock.calls[0]?.[0]).toBe(rowsWhere.mock.calls[0]?.[0]);
    expect(result).toMatchObject({
      total: 1,
      rows: [
        {
          id: "identity-subject",
          role: "client",
          emailStatus: "ok",
          kycStatus: "unverified",
          kycRetryCount: 0,
          createdAt,
          updatedAt,
        },
      ],
    });
  });
});
