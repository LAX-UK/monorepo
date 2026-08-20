import { bidIdentityDirectory } from "@auction/db/schema";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  activeIdentitySubject,
  normalizeIdentityEmail,
  normalizedIdentityEmailEquals,
} from "./bid-identity-directory-query.js";

const dialect = new PgDialect();

describe("bid identity directory query helpers", () => {
  it("normalizes surrounding whitespace and case", () => {
    expect(normalizeIdentityEmail("  Person@Example.COM ")).toBe("person@example.com");
  });

  it("builds normalized email and active canonical-subject predicates", () => {
    const emailQuery = dialect.sqlToQuery(
      normalizedIdentityEmailEquals(bidIdentityDirectory.email, " Person@Example.COM "),
    );
    const activeQuery = dialect.sqlToQuery(activeIdentitySubject());

    expect(emailQuery.sql).toContain('lower(trim("bid_identity_directory"."email"))');
    expect(emailQuery.params).toEqual(["person@example.com"]);
    expect(activeQuery.sql).toContain('"merged_into_subject_id" is null');
  });
});
