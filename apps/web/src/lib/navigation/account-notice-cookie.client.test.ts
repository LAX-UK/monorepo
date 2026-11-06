import { afterEach, describe, expect, it } from "vitest";
import { decodeAccountNotice } from "./account-notice";
import { clearAccountNotice, leaveAccountNotice } from "./account-notice-cookie.client";

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith("lax_account_notice="))
    ?.slice("lax_account_notice=".length);
}

afterEach(() => clearAccountNotice());

describe("account notice cookie", () => {
  it("leaves a notice the layout can read once", () => {
    leaveAccountNotice({ kind: "chose", accountId: "org-1" });
    expect(decodeAccountNotice(readCookie())).toEqual({ kind: "chose", accountId: "org-1" });
  });

  it("clears it once shown", () => {
    leaveAccountNotice({ kind: "chose", accountId: "org-1" });
    clearAccountNotice();
    expect(readCookie()).toBeUndefined();
  });
});
