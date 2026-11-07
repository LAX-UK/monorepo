import { afterEach, describe, expect, it } from "vitest";
import {
  clearAccountNotice,
  leaveAccountNotice,
  readAccountNotice,
} from "./account-notice-cookie.client";

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith("lax_account_notice="))
    ?.slice("lax_account_notice=".length);
}

const NOTICE = {
  kind: "chose",
  accountId: "org-1",
} as const;

afterEach(() => clearAccountNotice());

describe("account notice cookie", () => {
  it("leaves a notice the layout can read once", () => {
    leaveAccountNotice(NOTICE);
    expect(readAccountNotice()).toEqual(NOTICE);
  });

  it("clears it once shown", () => {
    leaveAccountNotice(NOTICE);
    clearAccountNotice();
    expect(readCookie()).toBeUndefined();
  });
});
