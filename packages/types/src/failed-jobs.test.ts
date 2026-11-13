import { describe, expect, it } from "vitest";
import {
  FAILED_JOBS_ANY_SOURCE_ACT_ACCESS,
  FAILED_JOBS_ANY_SOURCE_READ_ACCESS,
  FAILED_JOB_SOURCES,
  FAILED_JOB_SOURCE_ACCESS,
  type FailedJobSource,
  failedJobSourceFamily,
  failedJobSourcesFor,
} from "./failed-jobs.js";
import { userHasAccessTo } from "./role-policy.js";
import { userStaffRoles } from "./user.js";

const sourcesFor = (role: (typeof userStaffRoles)[number], mode: "read" | "act") =>
  failedJobSourcesFor([role], mode);

describe("FAILED_JOB_SOURCE_ACCESS", () => {
  it("has a row for every source", () => {
    expect(Object.keys(FAILED_JOB_SOURCE_ACCESS).sort()).toEqual([...FAILED_JOB_SOURCES].sort());
  });

  it("lets an administrator read and act on every source", () => {
    expect(sourcesFor("administrator", "read")).toEqual([...FAILED_JOB_SOURCES]);
    expect(sourcesFor("administrator", "act")).toEqual([...FAILED_JOB_SOURCES]);
  });

  it("gives finance Xero and Zoho Books only, to read and to act", () => {
    expect(sourcesFor("finance", "read")).toEqual(["integrations.xero", "integrations.books"]);
    expect(sourcesFor("finance", "act")).toEqual(["integrations.xero", "integrations.books"]);
  });

  it("lets read-only staff look at every source but Zoho Books (a Finance page) and change none", () => {
    expect(sourcesFor("read_only", "read")).toEqual(
      FAILED_JOB_SOURCES.filter((source) => source !== "integrations.books"),
    );
    expect(sourcesFor("read_only", "act")).toEqual([]);
  });

  it("hides every source from the other roles", () => {
    const others = userStaffRoles.filter(
      (role) => !["administrator", "finance", "read_only"].includes(role),
    );
    for (const role of others) {
      expect(sourcesFor(role, "read"), role).toEqual([]);
      expect(sourcesFor(role, "act"), role).toEqual([]);
    }
  });

  it("never lets someone act on a source they cannot read", () => {
    for (const role of userStaffRoles) {
      const read = new Set<FailedJobSource>(sourcesFor(role, "read"));
      for (const source of sourcesFor(role, "act")) expect(read.has(source), role).toBe(true);
    }
  });
});

describe("the any-source rules", () => {
  it("open the page to exactly the roles that read at least one source", () => {
    for (const role of userStaffRoles) {
      expect(userHasAccessTo("staff", [role], FAILED_JOBS_ANY_SOURCE_READ_ACCESS), role).toBe(
        sourcesFor(role, "read").length > 0,
      );
      expect(userHasAccessTo("staff", [role], FAILED_JOBS_ANY_SOURCE_ACT_ACCESS), role).toBe(
        sourcesFor(role, "act").length > 0,
      );
    }
  });
});

describe("failedJobSourceFamily", () => {
  it("groups the integrations", () => {
    expect(failedJobSourceFamily("background_jobs")).toBe("background_jobs");
    expect(failedJobSourceFamily("integrations.zoho")).toBe("integrations");
  });
});
