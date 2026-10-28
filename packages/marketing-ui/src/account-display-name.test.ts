import { describe, expect, it } from "vitest";
import { accountTriggerName } from "./account-display-name.js";

describe("accountTriggerName", () => {
  it("shows the first name only", () => {
    expect(accountTriggerName("Robert Thorpe-Smith", "r@example.com")).toBe("Robert");
    expect(accountTriggerName("  Ada  ", "a@example.com")).toBe("Ada");
  });

  it("uses the start of the email when there is no name", () => {
    expect(accountTriggerName("", "ada.l@example.com")).toBe("ada.l");
  });
});
