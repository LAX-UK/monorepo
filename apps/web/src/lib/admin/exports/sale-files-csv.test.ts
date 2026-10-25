import type { EntityDocument } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  matchesSaleDocumentSearch,
  matchesSaleMediaSearch,
  saleDocumentCsvRows,
  saleMediaCsvRows,
} from "./sale-files-csv";

const doc = (over: Partial<EntityDocument>): EntityDocument =>
  ({
    id: "d1",
    entityKind: "sale",
    entityId: "s1",
    kind: "terms",
    label: null,
    uploadObjectId: "u1",
    downloadUrl: "https://example.com/t.pdf",
    fileName: "terms-2026.pdf",
    byteSize: 1000,
    contentType: "application/pdf",
    createdByUserId: null,
    createdAt: new Date("2026-11-03T10:00:00Z"),
    ...over,
  }) as EntityDocument;

describe("sale files CSV", () => {
  it("writes documents with who can open them, never raw kinds", () => {
    const rows = saleDocumentCsvRows([
      doc({}),
      doc({ id: "d2", kind: "other", label: "Consignment schedule" }),
    ]);
    expect(rows[0]).toMatchObject({
      name: "terms-2026.pdf",
      type: "Terms of sale (PDF)",
      visibility: "Registered bidders",
    });
    expect(rows[1]).toMatchObject({ name: "Consignment schedule", visibility: "Staff only" });
  });

  it("writes media in gallery order, with no alt text for a video", () => {
    const rows = saleMediaCsvRows(
      [
        { key: "a.jpg", mediaType: "image", caption: "The room", alt: "Bidders seated" },
        { key: "b.mp4", mediaType: "video", caption: "Hammer down", alt: "ignored" },
      ],
      [1, 4],
    );
    expect(rows).toEqual([
      { position: "1", type: "Photo", caption: "The room", alt: "Bidders seated", key: "a.jpg" },
      { position: "4", type: "Video", caption: "Hammer down", alt: "", key: "b.mp4" },
    ]);
  });

  it("searches captions, alt text and file names", () => {
    const item = { key: "uploads/x.jpg", mediaType: "image" as const, caption: "Lot 12", alt: "" };
    expect(matchesSaleMediaSearch(item, "lot 12")).toBe(true);
    expect(matchesSaleMediaSearch(item, "x.jpg")).toBe(true);
    expect(matchesSaleMediaSearch(item, "hammer")).toBe(false);
    expect(matchesSaleDocumentSearch(doc({}), "terms of sale")).toBe(true);
    expect(matchesSaleDocumentSearch(doc({}), "catalogue")).toBe(false);
  });
});
