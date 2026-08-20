import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bidIdentityDirectory } from "./schema/bid-identity-directory.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0156 contract", () => {
  it("creates, backfills, grants, and can remove the Bid identity directory", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0156_bid_identity_directory.sql"), "utf8"),
      readFile(resolve(drizzle, "0156_rollback.sql"), "utf8"),
    ]);

    expect(getTableName(bidIdentityDirectory)).toBe("bid_identity_directory");
    expect(Object.keys(getTableColumns(bidIdentityDirectory))).toEqual([
      "subjectId",
      "email",
      "name",
      "image",
      "phone",
      "emailVerified",
      "deletionRequestedAt",
      "mergedIntoSubjectId",
      "identityCreatedAt",
      "replicatedAt",
      "lastEventId",
    ]);

    expect(forward).toContain('"subject_id" text PRIMARY KEY NOT NULL');
    expect(forward).not.toMatch(/"subject_id"[^,\n]*REFERENCES/i);
    expect(forward).toContain('"last_event_id" bigint DEFAULT 0 NOT NULL');
    expect(forward).toContain('"bid_identity_directory_email_idx"');
    expect(forward).toContain('"bid_identity_directory_phone_idx"');
    expect(forward).toContain('"bid_identity_directory_merged_into_idx"');
    expect(forward).toContain('u."phone_number"');
    expect(forward).toContain('u."merged_into_subject_id"');
    expect(forward).toContain('u."created_at"');
    expect(forward).toContain(
      "GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.bid_identity_directory TO worker_app",
    );
    expect(forward).toContain("GRANT SELECT ON TABLE public.bid_identity_directory TO api_app");
    expect(rollback).toContain('DROP TABLE IF EXISTS "bid_identity_directory"');
  });
});
