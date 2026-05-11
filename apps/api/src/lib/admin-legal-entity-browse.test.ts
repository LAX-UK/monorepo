import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLegalEntitiesForAdminBrowse } from "./admin-legal-entity-browse.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("searchLegalEntitiesForAdminBrowse", () => {
  it("applies ilike filter when q is non-empty", async () => {
    const offset = vi
      .fn()
      .mockResolvedValue([{ id: "a", displayName: "Acme Ltd", status: "approved" }]);
    const limit = vi.fn().mockReturnValue({ offset });
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where, orderBy });
    const db = {
      select: vi.fn().mockReturnValue({ from }),
    };

    const rows = await searchLegalEntitiesForAdminBrowse(db as never, {
      q: "acme",
      limit: 10,
      offset: 0,
    });

    expect(where).toHaveBeenCalled();
    expect(rows).toEqual([{ id: "a", displayName: "Acme Ltd", status: "approved" }]);
  });

  it("skips where when q is empty", async () => {
    const offset = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ offset });
    const orderBy = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ orderBy });
    const db = {
      select: vi.fn().mockReturnValue({ from }),
    };

    await searchLegalEntitiesForAdminBrowse(db as never, {
      q: "   ",
      limit: 5,
      offset: 2,
    });

    expect(from).toHaveBeenCalled();
    expect(from.mock.results[0]?.value.where).toBeUndefined();
    expect(orderBy).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(5);
    expect(offset).toHaveBeenCalledWith(2);
  });
});
