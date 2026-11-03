import { describe, expect, it } from "vitest";
import { deletedUserPseudonym } from "./deleted-user-pseudonym.js";

describe("deletedUserPseudonym", () => {
  it("is stable for a subject", () => {
    expect(deletedUserPseudonym("user_1")).toBe(deletedUserPseudonym("user_1"));
  });

  it("has the shape 'Deleted user' followed by four uppercase hex characters", () => {
    expect(deletedUserPseudonym("user_1")).toMatch(/^Deleted user [0-9A-F]{4}$/);
    expect(deletedUserPseudonym("")).toMatch(/^Deleted user [0-9A-F]{4}$/);
  });

  it("tells different subjects apart in practice", () => {
    expect(deletedUserPseudonym("user_1")).not.toBe(deletedUserPseudonym("user_2"));
  });

  it("does not echo the subject id", () => {
    expect(deletedUserPseudonym("ABCD1234")).not.toContain("ABCD1234");
  });
});
