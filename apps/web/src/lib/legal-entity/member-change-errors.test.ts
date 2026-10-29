import { describe, expect, it } from "vitest";
import { memberChangeFailure } from "./member-change-errors";

describe("memberChangeFailure", () => {
  it("gives known codes plain words", () => {
    expect(memberChangeFailure({ error: "already_a_member", code: "already_a_member" })).toEqual({
      code: "already_a_member",
      error: "This person is already a member.",
    });
  });

  it("keeps a sentence the server wrote for clients", () => {
    const error = "Only an owner can grant, change or remove the owner role.";
    expect(memberChangeFailure({ error, code: "owner_only" })).toEqual({
      code: "owner_only",
      error,
    });
  });

  it("never shows an unknown code", () => {
    expect(memberChangeFailure({ error: "update_failed_500" })).toEqual({
      code: "update_failed_500",
      error: "That didn't go through. Try again in a moment.",
    });
    expect(memberChangeFailure({})).toMatchObject({ code: null });
  });
});
