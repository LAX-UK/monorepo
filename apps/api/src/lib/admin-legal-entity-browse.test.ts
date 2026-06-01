import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLegalEntitiesForAdminBrowse } from "./admin-legal-entity-browse.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockDb(options: {
  countTotal?: number;
  rows?: {
    id: string;
    displayName: string;
    status: string;
    kind: string;
    subkind: string;
    updatedAt: Date;
    stripeDueCount: number;
  }[];
}) {
  const countTotal = options.countTotal ?? options.rows?.length ?? 0;
  const rows = options.rows ?? [];

  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ offset });
  const orderBy = vi.fn().mockReturnValue({ limit });
  const countWhere = vi.fn().mockResolvedValue([{ n: countTotal }]);
  const countFromResult = Object.assign(Promise.resolve([{ n: countTotal }]), {
    where: countWhere,
  });
  const countFrom = vi.fn().mockReturnValue(countFromResult);

  const listWhere = vi.fn().mockReturnValue({ orderBy });
  const listFromResult = {
    where: listWhere,
    orderBy,
  };
  const listFrom = vi.fn().mockReturnValue(listFromResult);

  let selectCall = 0;
  const listSelect = vi.fn().mockReturnValue({ from: listFrom });
  const countSelect = vi.fn().mockReturnValue({ from: countFrom });
  const db = {
    select: vi.fn().mockImplementation(() => {
      selectCall += 1;
      return selectCall === 1 ? countSelect() : listSelect();
    }),
  };

  return { db, listWhere, countWhere, limit, offset };
}

describe("searchLegalEntitiesForAdminBrowse", () => {
  it("returns rows and total", async () => {
    const updatedAt = new Date("2026-01-01T00:00:00.000Z");
    const { db } = mockDb({
      countTotal: 1,
      rows: [
        {
          id: "a",
          displayName: "Acme Ltd",
          status: "approved",
          kind: "organisation",
          subkind: "gallery",
          updatedAt,
          stripeDueCount: 0,
        },
      ],
    });

    const result = await searchLegalEntitiesForAdminBrowse(db as never, {
      q: "acme",
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.rows).toEqual([
      {
        id: "a",
        displayName: "Acme Ltd",
        status: "approved",
        kind: "organisation",
        subkind: "gallery",
        updatedAt,
        stripeDueCount: 0,
      },
    ]);
  });

  it("applies where when q is non-empty", async () => {
    const { db, listWhere } = mockDb({ countTotal: 0, rows: [] });

    await searchLegalEntitiesForAdminBrowse(db as never, {
      q: "acme",
      limit: 10,
      offset: 0,
    });

    expect(listWhere).toHaveBeenCalled();
  });

  it("skips list where when no filters", async () => {
    const { db, listWhere } = mockDb({ countTotal: 0, rows: [] });

    await searchLegalEntitiesForAdminBrowse(db as never, {
      q: "   ",
      limit: 5,
      offset: 2,
    });

    expect(listWhere).not.toHaveBeenCalled();
  });

  it("filters by createdByUserId when provided", async () => {
    const { db, listWhere } = mockDb({
      countTotal: 1,
      rows: [
        {
          id: "le-1",
          displayName: "Seller Co",
          status: "approved",
          kind: "organisation",
          subkind: "dealer",
          updatedAt: new Date(),
          stripeDueCount: 2,
        },
      ],
    });

    const result = await searchLegalEntitiesForAdminBrowse(db as never, {
      createdByUserId: "user-abc",
      limit: 10,
      offset: 0,
    });

    expect(listWhere).toHaveBeenCalled();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.stripeDueCount).toBe(2);
  });

  it("filters by status and stripeDue", async () => {
    const { db, listWhere } = mockDb({ countTotal: 0, rows: [] });

    await searchLegalEntitiesForAdminBrowse(db as never, {
      status: "under_review",
      stripeDue: true,
      limit: 10,
      offset: 0,
    });

    expect(listWhere).toHaveBeenCalled();
  });
});
