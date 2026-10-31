import { describe, expect, it } from "vitest";
import { ownerContacts } from "./owner-contacts.js";

const JOINED = new Date("2026-01-01T00:00:00Z");

function member(
  name: string,
  role: "owner" | "admin" | "viewer",
  extra: Partial<{ isPrimaryAdmin: boolean; acceptedAt: Date | null; removedAt: Date | null }> = {},
) {
  return {
    role,
    isPrimaryAdmin: false,
    acceptedAt: JOINED,
    removedAt: null,
    user: { name, email: `${name.toLowerCase() || "sam"}@northbank.gallery` },
    ...extra,
  };
}

describe("ownerContacts", () => {
  it("names active owners only, the primary owner first", () => {
    expect(
      ownerContacts([
        member("Jonah", "owner"),
        member("Tom", "admin"),
        member("Maya", "owner", { isPrimaryAdmin: true }),
        member("Left", "owner", { removedAt: JOINED }),
        member("Invited", "owner", { acceptedAt: null }),
      ]),
    ).toEqual([{ name: "Maya" }, { name: "Jonah" }]);
  });

  it("never shows another member's full email", () => {
    expect(ownerContacts([member("", "owner")])).toEqual([{ name: "sam" }]);
  });
});
