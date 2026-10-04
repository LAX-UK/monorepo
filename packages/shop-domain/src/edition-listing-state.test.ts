import { describe, expect, it } from "vitest";
import { type EditionListingStatus, canTransitionListingStatus } from "./edition-listing-state.js";

const ALL: EditionListingStatus[] = [
  "not_authorised",
  "authorised",
  "reserved",
  "held",
  "sold",
  "withdrawn",
];

const ALLOWED: Record<EditionListingStatus, readonly EditionListingStatus[]> = {
  not_authorised: ["not_authorised", "authorised", "withdrawn"],
  authorised: ["authorised", "not_authorised", "reserved", "held", "sold"],
  reserved: ["reserved", "authorised", "sold"],
  held: ["held", "authorised", "sold"],
  sold: ["sold", "authorised"],
  withdrawn: ["withdrawn", "not_authorised"],
};

describe("edition listing transitions", () => {
  it.each(ALL.flatMap((from) => ALL.map((to) => [from, to] as const)))("%s -> %s", (from, to) => {
    expect(canTransitionListingStatus(from, to)).toBe(ALLOWED[from].includes(to));
  });
});
