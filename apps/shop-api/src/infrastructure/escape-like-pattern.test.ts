import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "./escape-like-pattern.js";

describe("escapeLikePattern", () => {
  it("leaves ordinary text alone", () => {
    expect(escapeLikePattern("tote bag")).toBe("tote bag");
  });

  it("escapes wildcards and the escape character itself", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
