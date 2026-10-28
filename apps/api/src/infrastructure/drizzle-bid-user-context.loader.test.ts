import type { StaffRoles } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { DrizzleBidUserContextLoader } from "./drizzle-bid-user-context.loader.js";

function databaseReturning(row: Record<string, unknown>) {
  const limit = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { select: vi.fn(() => ({ from })) };
}

const NOW = new Date("2026-10-28T12:00:00.000Z");

function loader(row: Record<string, unknown>, roles: StaffRoles = []) {
  const staffRoles = { listActiveRoles: vi.fn().mockResolvedValue(roles) };
  return {
    staffRoles,
    loader: new DrizzleBidUserContextLoader(databaseReturning(row) as never, staffRoles, () => NOW),
  };
}

const lifecycle = { suspendedAt: null, identityDisabledAt: null, mergedIntoSubjectId: null };

describe("DrizzleBidUserContextLoader", () => {
  it("uses the product lifecycle projection without an Identity fallback", async () => {
    const identityDisabledAt = new Date("2026-08-01T00:00:00.000Z");
    const row = {
      role: "client",
      suspendedAt: null,
      identityDisabledAt,
      mergedIntoSubjectId: "canonical",
    };
    const { loader: subject, staffRoles } = loader(row);

    expect(await subject.loadContext("retired")).toEqual({ ...row, staffRoles: [] });
    expect(staffRoles.listActiveRoles).not.toHaveBeenCalled();
  });

  it("preserves Bid suspension independently from Identity lifecycle state", async () => {
    const suspendedAt = new Date("2026-08-02T00:00:00.000Z");
    const row = { ...lifecycle, role: "client", suspendedAt };

    await expect(loader(row).loader.loadContext("bid-suspended")).resolves.toEqual({
      ...row,
      staffRoles: [],
    });
  });

  it("loads a staff member's roles in force once, for this request", async () => {
    const { loader: subject, staffRoles } = loader({ ...lifecycle, role: "staff" }, [
      "specialist",
      "client_advisor",
    ]);

    const context = await subject.loadContext("staff-1");

    expect(context?.staffRoles).toEqual(["specialist", "client_advisor"]);
    expect(staffRoles.listActiveRoles).toHaveBeenCalledTimes(1);
    expect(staffRoles.listActiveRoles).toHaveBeenCalledWith("staff-1", NOW);
  });
});
