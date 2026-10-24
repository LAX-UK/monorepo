import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildAuditLogWhere, escapeLikePattern } from "./audit-log-sql.js";

const dialect = new PgDialect();
const base = { limit: 50, offset: 0 };

describe("buildAuditLogWhere", () => {
  it("has no predicate without filters", () => {
    expect(buildAuditLogWhere(base)).toBeUndefined();
  });

  it("matches text against the event type, entity id and actor, never the payload", () => {
    const where = buildAuditLogWhere({ ...base, q: "two factor" });
    if (!where) throw new Error("expected a predicate");
    const query = dialect.sqlToQuery(where);
    expect(query.sql).toContain('"domain_events"."event_type" ilike');
    expect(query.sql).toContain('"domain_events"."aggregate_id" ilike');
    expect(query.sql).toContain('"bid_identity_directory"."email" ilike');
    expect(query.sql).not.toContain("payload");
    expect(query.params).toContain("%two\\_factor%");
    expect(query.params).toContain("%two factor%");
  });

  it("matches client names and emails only when the caller may see them", () => {
    const hidden = buildAuditLogWhere({ ...base, q: "jane" });
    const shown = buildAuditLogWhere({ ...base, q: "jane", matchClientActors: true });
    if (!hidden || !shown) throw new Error("expected predicates");
    expect(dialect.sqlToQuery(hidden).sql).toContain('"bid_user_profile"."role" = $');
    expect(dialect.sqlToQuery(hidden).params).toContain("staff");
    expect(dialect.sqlToQuery(shown).sql).not.toContain('"bid_user_profile"."role"');
  });

  it("treats wildcard characters in the text as literals", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
    const where = buildAuditLogWhere({ ...base, q: "100%" });
    if (!where) throw new Error("expected a predicate");
    expect(dialect.sqlToQuery(where).params).toContain("%100\\%%");
  });

  it("combines exact types and view prefixes as alternatives, then ands the rest", () => {
    const where = buildAuditLogWhere({
      ...base,
      actorUserId: "actor-1",
      eventTypes: ["lot.created"],
      eventTypePrefixes: ["payment.", "lax.staff_access."],
      aggregateType: "lot",
    });
    if (!where) throw new Error("expected a predicate");
    const query = dialect.sqlToQuery(where);
    expect(query.sql).toContain('"domain_events"."actor_user_id" = $1');
    expect(query.sql).toContain('"domain_events"."event_type" in ($');
    expect(query.sql).toContain(" or ");
    expect(query.params).toEqual(
      expect.arrayContaining([
        "actor-1",
        "lot.created",
        "payment.%",
        "lax.staff\\_access.%",
        "lot",
      ]),
    );
  });

  it("bounds a date range by whole London days, end day included", () => {
    const where = buildAuditLogWhere({ ...base, fromDay: "2026-10-01", toDay: "2026-10-24" });
    if (!where) throw new Error("expected a predicate");
    const query = dialect.sqlToQuery(where);
    expect(query.sql).toContain('"domain_events"."occurred_at" >=');
    expect(query.sql).toContain('"domain_events"."occurred_at" <');
    expect(query.sql).toContain("+ 1");
    expect(query.sql).toContain("at time zone");
    expect(query.params).toEqual(expect.arrayContaining(["2026-10-01", "2026-10-24"]));
  });
});
