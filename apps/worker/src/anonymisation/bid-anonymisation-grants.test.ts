import { WORKER_ANONYMISATION_DELETE_TABLES, WORKER_FULL_TABLES } from "@auction/db/migrate-roles";
import { describe, expect, it } from "vitest";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

/**
 * Account erasure deletes rows as `worker_app`. A table a rule deletes from without a DELETE grant
 * fails the whole erasure with `permission denied`, so the rules and the grants are tied together.
 */

/** Deleted by the alert-subscriber rule's own erase call, which the rule reports alongside its table. */
const DELETED_BY_ALERT_ERASURE = ["visitor_sale_alert_subscriber"];

describe("account erasure rules and the worker DELETE grants", () => {
  const deleted = BID_ANONYMISATION_RULES.filter((rule) => rule.treatment === "delete").map(
    (rule) => rule.table,
  );
  const granted: readonly string[] = WORKER_ANONYMISATION_DELETE_TABLES;
  const grantedElsewhere: readonly string[] = WORKER_FULL_TABLES;

  it("grants DELETE on every table a delete rule removes rows from", () => {
    const missing = deleted.filter(
      (table) => !granted.includes(table) && !grantedElsewhere.includes(table),
    );
    expect(missing).toEqual([]);
  });

  it("grants DELETE here only on tables a delete rule uses", () => {
    const unused = granted.filter(
      (table) => !deleted.includes(table) && !DELETED_BY_ALERT_ERASURE.includes(table),
    );
    expect(unused).toEqual([]);
  });
});
