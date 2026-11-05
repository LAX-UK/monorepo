import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildAdminListFilters } from "./artist-profile/artist-profile-list-filters.js";
import { partialSearchPattern } from "./artist-registry.helpers.js";
import { buildAuditLogWhere } from "./audit-log-sql.js";
import { listWhere } from "./lot/lot-list-filters.js";

const dialect = new PgDialect();

function paramsOf(clause: Parameters<typeof dialect.sqlToQuery>[0] | undefined) {
  if (!clause) throw new Error("Expected a predicate");
  return dialect.sqlToQuery(clause).params;
}

describe("search patterns built from typed text", () => {
  it("escapes wildcards in the admin artist search", () => {
    const params = paramsOf(buildAdminListFilters({ q: "50%_a\\", limit: 10, offset: 0 }));
    expect(params).toContain("%50\\%\\_a\\\\%");
  });

  it("escapes wildcards in the lot title search", () => {
    const params = paramsOf(listWhere({ search: "50%" }));
    expect(params).toContain("%50\\%%");
  });

  it("escapes wildcards in the audit log search", () => {
    const params = paramsOf(buildAuditLogWhere({ q: "a_b", limit: 10, offset: 0 }));
    expect(params).toContain("%a\\_b%");
  });

  it("escapes wildcards in the artist registry search pattern", () => {
    expect(partialSearchPattern("  50%  ")).toBe("%50\\%%");
  });
});
