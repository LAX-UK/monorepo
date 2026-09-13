import { describe, expect, it } from "vitest";
import { describeUserReadCutover, formatUserReadCutover } from "./applied-user-read-cutover.js";
import { PRODUCTION_MIGRATION_CEILING_BY_TAG } from "./production-migration-ceiling.js";

describe("describeUserReadCutover", () => {
  it("keeps soak grants before 0160", () => {
    expect(describeUserReadCutover(null)).toEqual({
      lastAppliedFolderMillis: null,
      head: "none",
      workerUserSelectRevoked: false,
      apiUserSelectRevoked: false,
    });
    expect(
      describeUserReadCutover(PRODUCTION_MIGRATION_CEILING_BY_TAG["0159"].folderMillis),
    ).toMatchObject({
      head: "0159",
      workerUserSelectRevoked: false,
      apiUserSelectRevoked: false,
    });
  });

  it("revokes worker reads at 0160 and API reads at 0161", () => {
    expect(
      describeUserReadCutover(PRODUCTION_MIGRATION_CEILING_BY_TAG["0160"].folderMillis),
    ).toMatchObject({
      head: "0160",
      workerUserSelectRevoked: true,
      apiUserSelectRevoked: false,
    });
    expect(
      describeUserReadCutover(PRODUCTION_MIGRATION_CEILING_BY_TAG["0161"].folderMillis),
    ).toMatchObject({
      head: "0161",
      workerUserSelectRevoked: true,
      apiUserSelectRevoked: true,
    });
  });

  it("formats a bounded operator line", () => {
    expect(
      formatUserReadCutover(
        describeUserReadCutover(PRODUCTION_MIGRATION_CEILING_BY_TAG["0159"].folderMillis),
      ),
    ).toContain("head=0159");
  });
});
