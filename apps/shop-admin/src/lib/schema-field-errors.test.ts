import { ArtistSeoWriteBodySchema, SEO_TITLE_MAX_LENGTH } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { schemaFieldErrors } from "./schema-field-errors";

describe("schemaFieldErrors", () => {
  const messages = { seoTitle: "SEO title is too long." };

  it("accepts a body the server would accept", () => {
    expect(
      schemaFieldErrors(
        ArtistSeoWriteBodySchema,
        { seoTitle: "Title", seoDescription: null },
        messages,
      ),
    ).toEqual({});
  });

  it("reports the field the schema rejects, using the supplied wording", () => {
    const body = { seoTitle: "x".repeat(SEO_TITLE_MAX_LENGTH + 1), seoDescription: null };
    expect(schemaFieldErrors(ArtistSeoWriteBodySchema, body, messages)).toEqual({
      seoTitle: "SEO title is too long.",
    });
  });

  it("falls back to the schema message when no wording is supplied", () => {
    const errors = schemaFieldErrors(ArtistSeoWriteBodySchema, { seoTitle: null }, {});
    expect(Object.keys(errors)).toEqual(["seoDescription"]);
    expect(errors.seoDescription).toBeTruthy();
  });
});
