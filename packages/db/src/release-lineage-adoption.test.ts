import { describe, expect, it } from "vitest";
import { adoptionFor, resolveReleaseLineageAdoptions } from "./release-lineage-adoption.js";
import { RELEASE_LINEAGE_ADOPTIONS } from "./release-lineage-mapping.js";
import type { ArchivedReleaseRow } from "./release-lineage-normalisation.js";

const fullArchive: ArchivedReleaseRow[] = RELEASE_LINEAGE_ADOPTIONS.map((entry) => ({
  createdAt: entry.releaseWhen,
  hash: entry.sha256,
  releaseTag: entry.releaseTag,
}));

describe("release lineage adoption", () => {
  it("adopts nothing without an archive (test, developer and CI databases)", () => {
    expect(resolveReleaseLineageAdoptions([]).size).toBe(0);
  });

  it("adopts every allow-listed main migration whose release row is archived", () => {
    const adoptions = resolveReleaseLineageAdoptions(fullArchive);
    expect([...adoptions.values()].map((a) => a.mainTag)).toEqual(
      RELEASE_LINEAGE_ADOPTIONS.map((a) => a.mainTag),
    );
    for (const entry of RELEASE_LINEAGE_ADOPTIONS) {
      expect(adoptions.get(entry.mainWhen)).toBe(entry);
    }
  });

  it("does not adopt when the archived release row holds another hash or stamp", () => {
    const [first] = RELEASE_LINEAGE_ADOPTIONS;
    if (!first) throw new Error("allow-list is empty");
    const otherHash = fullArchive.map((row) =>
      row.createdAt === first.releaseWhen ? { ...row, hash: "other" } : row,
    );
    expect(resolveReleaseLineageAdoptions(otherHash).has(first.mainWhen)).toBe(false);
    const otherStamp = fullArchive.map((row) =>
      row.createdAt === first.releaseWhen ? { ...row, createdAt: 1 } : row,
    );
    expect(resolveReleaseLineageAdoptions(otherStamp).has(first.mainWhen)).toBe(false);
  });

  it("adopts only from the allow-list, never an archived hash alone", () => {
    const archive = [{ createdAt: 1795593660000, hash: "c37a", releaseTag: "0135_x" }];
    expect(resolveReleaseLineageAdoptions(archive).size).toBe(0);
  });

  it("returns the adoption for a matching migration and nothing for others", () => {
    const adoptions = resolveReleaseLineageAdoptions(fullArchive);
    const [first] = RELEASE_LINEAGE_ADOPTIONS;
    if (!first) throw new Error("allow-list is empty");
    expect(adoptionFor({ folderMillis: first.mainWhen, hash: first.sha256 }, adoptions)).toBe(
      first,
    );
    expect(adoptionFor({ folderMillis: 42, hash: "x" }, adoptions)).toBeNull();
  });

  it("fails closed if main's SQL at an adopted stamp changed since approval", () => {
    const adoptions = resolveReleaseLineageAdoptions(fullArchive);
    const [first] = RELEASE_LINEAGE_ADOPTIONS;
    if (!first) throw new Error("allow-list is empty");
    expect(() => adoptionFor({ folderMillis: first.mainWhen, hash: "edited" }, adoptions)).toThrow(
      /no longer matches release .* cannot be adopted/,
    );
  });
});
