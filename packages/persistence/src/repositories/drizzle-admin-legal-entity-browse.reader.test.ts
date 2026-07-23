import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleAdminLegalEntityBrowseReader } from "../repositories/drizzle-admin-legal-entity-browse.reader.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockDb(options: {
  countTotal?: number;
  summaryRow?: Record<string, number>;
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
  const summaryRow = options.summaryRow ?? {
    total: countTotal,
    lead: 0,
    docs_requested: 0,
    docs_received: 0,
    under_review: 0,
    connect_pending: 0,
    approved: countTotal,
    restricted: 0,
    rejected: 0,
    archived: 0,
    stripeDueCount: 0,
    individual: 0,
    organisation: countTotal,
  };

  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ offset });
  const orderBy = vi.fn().mockReturnValue({ limit });
  const listWhere = vi.fn().mockReturnValue({ orderBy });
  const listFromResult = {
    where: listWhere,
    orderBy,
  };
  const listFrom = vi.fn().mockReturnValue(listFromResult);
  const listSelect = vi.fn().mockReturnValue({ from: listFrom });

  const summaryWhere = vi.fn().mockResolvedValue([summaryRow]);
  const summaryFrom = Object.assign(Promise.resolve([summaryRow]), {
    where: summaryWhere,
  });
  const summarySelect = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(summaryFrom) });

  let selectCall = 0;
  const db = {
    select: vi.fn().mockImplementation(() => {
      selectCall += 1;
      return selectCall === 1 ? summarySelect() : listSelect();
    }),
  };

  return { db, listWhere, summaryWhere, limit, offset };
}

describe("DrizzleAdminLegalEntityBrowseReader.searchLegalEntitiesBrowse", () => {
  it("returns rows, total, and summary", async () => {
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

    const reader = new DrizzleAdminLegalEntityBrowseReader(db as never);
    const result = await reader.searchLegalEntitiesBrowse({
      q: "acme",
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.summary.total).toBe(1);
    expect(result.summary.byKind.organisation).toBe(1);
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

    const reader = new DrizzleAdminLegalEntityBrowseReader(db as never);
    await reader.searchLegalEntitiesBrowse({
      q: "acme",
      limit: 10,
      offset: 0,
    });

    expect(listWhere).toHaveBeenCalled();
  });

  it("skips list where when no filters", async () => {
    const { db, listWhere } = mockDb({ countTotal: 0, rows: [] });

    const reader = new DrizzleAdminLegalEntityBrowseReader(db as never);
    await reader.searchLegalEntitiesBrowse({
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

    const reader = new DrizzleAdminLegalEntityBrowseReader(db as never);
    const result = await reader.searchLegalEntitiesBrowse({
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

    const reader = new DrizzleAdminLegalEntityBrowseReader(db as never);
    await reader.searchLegalEntitiesBrowse({
      status: "under_review",
      stripeDue: true,
      limit: 10,
      offset: 0,
    });

    expect(listWhere).toHaveBeenCalled();
  });
});

describe("DrizzleAdminLegalEntityBrowseReader.summarizeLegalEntitiesBrowse", () => {
  it("returns aggregate counts for filtered browse", async () => {
    const { db } = mockDb({
      summaryRow: {
        total: 3,
        lead: 1,
        docs_requested: 0,
        docs_received: 1,
        under_review: 1,
        connect_pending: 0,
        approved: 0,
        restricted: 0,
        rejected: 0,
        archived: 0,
        stripeDueCount: 2,
        individual: 1,
        organisation: 2,
      },
    });
    const reader = new DrizzleAdminLegalEntityBrowseReader(db as never);

    await expect(reader.summarizeLegalEntitiesBrowse({ status: "under_review" })).resolves.toEqual({
      total: 3,
      byStatus: {
        lead: 1,
        docs_requested: 0,
        docs_received: 1,
        under_review: 1,
        connect_pending: 0,
        approved: 0,
        restricted: 0,
        rejected: 0,
        archived: 0,
      },
      stripeDueCount: 2,
      byKind: { individual: 1, organisation: 2 },
    });
  });
});
