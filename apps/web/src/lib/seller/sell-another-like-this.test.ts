import type { ItemSubmission } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  COPIED_FIELDS,
  copyFromValues,
  loadCopyFrom,
  sellAnotherLikeThisHref,
  startedFromNotice,
} from "./sell-another-like-this";

function submission(over: Partial<ItemSubmission> = {}): ItemSubmission {
  return {
    id: "sub-1",
    legalEntityId: "le-1",
    title: "Harbour at dusk, no. 3",
    description: "Third of a series of harbour views.",
    medium: "Screenprint on paper",
    dimensions: "50 × 70 cm",
    images: ["https://media.example/harbour-3.jpg"],
    yearOfWork: "2019",
    isSigned: true,
    signatureNote: "Signed lower right",
    edition: "12/50",
    conditionSelfReport: "Small crease top left",
    provenance: [{ period: "2019", note: "Bought from the artist's studio" }],
    exhibitions: [{ year: "2020", venue: "Harbour Gallery" }],
    askingPrice: "1200",
    reservePrice: "1500",
    categoryIds: ["cat-prints", "cat-contemporary"],
    categoryId: "cat-prints",
    submitterNotes: "Can deliver in person",
    status: "submitted",
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReason: null,
    convertedLotId: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
    ...over,
  };
}

describe("copyFromValues", () => {
  it("copies category, medium, edition, signed and provenance", () => {
    const values = copyFromValues(submission());
    expect(values.categoryIds).toEqual(["cat-prints", "cat-contemporary"]);
    expect(values.medium).toBe("Screenprint on paper");
    expect(values.edition).toBe("12/50");
    expect(values.isSigned).toBe(true);
    expect(values.provenance).toEqual([
      { period: "2019", note: "Bought from the artist's studio" },
    ]);
  });

  it("never copies the title, photos, size, prices, condition or notes", () => {
    const values = copyFromValues(submission());
    expect(values.title).toBe("");
    expect(values.images).toEqual([]);
    expect(values.dimensions).toBe("");
    expect(values.askingPrice).toBe("");
    expect(values.reservePrice).toBe("");
    expect(values.conditionSelfReport).toBe("");
    expect(values.submitterNotes).toBe("");
    expect(values.signatureNote).toBe("");
    expect(values.description).toBe("");
    expect(values.yearOfWork).toBe("");
    expect(values.exhibitions).toEqual([]);
  });

  it("names exactly the copied fields", () => {
    expect([...COPIED_FIELDS].sort()).toEqual(
      ["categoryIds", "edition", "isSigned", "medium", "provenance"].sort(),
    );
  });

  it("falls back to the single category of an older submission", () => {
    expect(copyFromValues(submission({ categoryIds: [] })).categoryIds).toEqual(["cat-prints"]);
  });

  it("leaves blanks where the source had nothing", () => {
    const { isSigned: _signed, provenance: _provenance, ...rest } = submission();
    const values = copyFromValues({ ...rest, medium: null, edition: null });
    expect(values.medium).toBe("");
    expect(values.edition).toBe("");
    expect(values.isSigned).toBe(false);
    expect(values.provenance).toEqual([]);
  });

  it("does not share the source's provenance entries", () => {
    const source = submission();
    const values = copyFromValues(source);
    values.provenance[0] = { note: "changed" };
    expect(source.provenance?.[0]?.note).toBe("Bought from the artist's studio");
  });
});

describe("loadCopyFrom", () => {
  it("starts nothing without a source", async () => {
    const read = vi.fn();
    expect(await loadCopyFrom(undefined, read)).toEqual({ kind: "none" });
    expect(await loadCopyFrom("  ", read)).toEqual({ kind: "none" });
    expect(read).not.toHaveBeenCalled();
  });

  it("starts from the client's own work, with its title for the notice", async () => {
    const read = vi.fn(async () => submission());
    const result = await loadCopyFrom("sub-1", read);
    expect(read).toHaveBeenCalledWith("sub-1");
    expect(result).toEqual({
      kind: "found",
      values: copyFromValues(submission()),
      sourceTitle: "Harbour at dusk, no. 3",
    });
  });

  it("is not found for someone else's submission (the viewing rule answers 404)", async () => {
    // The reader is the same one the consignment page uses: another client's or another
    // organisation's submission comes back as null.
    const mine = new Map([["sub-1", submission()]]);
    const read = async (id: string) => mine.get(id) ?? null;
    expect(await loadCopyFrom("someone-elses", read)).toEqual({ kind: "not-found" });
  });

  it("is not found when the submission cannot be read", async () => {
    const read = vi.fn(async () => {
      throw new Error("403");
    });
    expect(await loadCopyFrom("sub-1", read)).toEqual({ kind: "not-found" });
  });
});

describe("links and copy", () => {
  it("links to the wizard with the source", () => {
    expect(sellAnotherLikeThisHref("sub 1/2")).toBe("/selling/new?copyFrom=sub%201%2F2");
  });

  it("names the source and asks for every step to be checked", () => {
    const { title, detail } = startedFromNotice("Harbour at dusk, no. 3");
    expect(`${title} ${detail}`).toBe(
      "Started from Harbour at dusk, no. 3. Check every step before you send it.",
    );
  });
});
