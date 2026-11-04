import { describe, expect, it } from "vitest";
import {
  ADMIN_NOTICES,
  adminNoticeCodeForStatus,
  isAdminNoticeCode,
  resolveAdminNotice,
} from "./admin-notice";

describe("resolveAdminNotice", () => {
  it("maps a success code to its fixed copy", () => {
    expect(resolveAdminNotice("entity_archived")).toEqual({
      success: ADMIN_NOTICES.entity_archived.message,
      error: null,
    });
  });

  it("maps an error code to its fixed copy", () => {
    expect(resolveAdminNotice("reason_too_short")).toEqual({
      success: null,
      error: ADMIN_NOTICES.reason_too_short.message,
    });
  });

  it("uses the first value when the param is repeated", () => {
    expect(resolveAdminNotice(["entity_rejected", "conflict"]).success).toBe("Entity rejected.");
  });

  it("shows nothing for text, unknown codes or inherited object keys", () => {
    const none = { success: null, error: null };
    expect(resolveAdminNotice("Your account is locked, call 0800 123")).toEqual(none);
    expect(resolveAdminNotice("toString")).toEqual(none);
    expect(resolveAdminNotice("__proto__")).toEqual(none);
    expect(resolveAdminNotice(undefined)).toEqual(none);
    expect(resolveAdminNotice([])).toEqual(none);
  });
});

describe("adminNoticeCodeForStatus", () => {
  it.each([
    [403, "not_permitted"],
    [404, "entity_missing"],
    [409, "conflict"],
    [500, "action_failed"],
  ] as const)("status %i -> %s", (status, code) => {
    expect(adminNoticeCodeForStatus(status)).toBe(code);
    expect(isAdminNoticeCode(code)).toBe(true);
  });
});
