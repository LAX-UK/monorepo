import { describe, expect, it } from "vitest";
import { roleInSentence } from "./role-in-sentence";

describe("roleInSentence", () => {
  it.each([
    ["buyer_agent", "a buyer agent"],
    ["admin", "an admin"],
    ["owner", "an owner"],
    ["finance", "a finance member"],
    ["gallery_curator", "a gallery curator"],
    ["viewer", "a viewer"],
    ["consignor", "a consignor"],
  ])("reads %s as %s", (role, phrase) => {
    expect(roleInSentence(role)).toBe(phrase);
  });
});
