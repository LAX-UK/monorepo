import { describe, expect, it } from "vitest";
import { formatAdminUserDate } from "./format-admin-user-date";

describe("formatAdminUserDate", () => {
  it("uses en-GB regardless of runtime default locale", () => {
    const formatted = formatAdminUserDate("2026-05-11T12:00:00.000Z");
    expect(formatted).toBe(
      new Date("2026-05-11T12:00:00.000Z").toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );
    expect(formatted).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
  });
});
