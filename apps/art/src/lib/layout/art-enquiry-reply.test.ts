import type { AccountChromeState } from "@auction/lax-ecosystem";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/art-services.server", () => ({ artServices: { portal: {} } }));

import { isEnquiryReplyWaiting } from "@/lib/account/account-enquiries.vm";
import { composeArtEnquiryReplyDot } from "./art-enquiry-reply.server.js";

const SIGNED_IN: AccountChromeState = {
  kind: "authenticated",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  accountHref: "/account",
  logoutHref: "/logout",
};
const GUEST: AccountChromeState = { kind: "guest", loginHref: "/login", registerHref: "/register" };

function portal(result: unknown) {
  return { listEnquiries: vi.fn().mockResolvedValue(result) };
}

describe("enquiry reply dot", () => {
  it.each([
    ["replied", true],
    ["Responded", true],
    ["answered", true],
    ["open", false],
    ["pending", false],
    ["closed", false],
    ["resolved", false],
  ])("treats status %s as reply waiting: %s", (status, expected) => {
    expect(isEnquiryReplyWaiting(status)).toBe(expected);
  });

  it("is on when an artwork enquiry has a reply", async () => {
    const read = portal({ status: "ok", data: [{ status: "open" }, { status: "replied" }] });
    expect(await composeArtEnquiryReplyDot(SIGNED_IN, read as never)).toBe(true);
  });

  it("is off when nothing has been replied to", async () => {
    const read = portal({ status: "ok", data: [{ status: "open" }] });
    expect(await composeArtEnquiryReplyDot(SIGNED_IN, read as never)).toBe(false);
  });

  it("does not read anything for a signed-out visitor", async () => {
    const read = portal({ status: "ok", data: [{ status: "replied" }] });
    expect(await composeArtEnquiryReplyDot(GUEST, read as never)).toBe(false);
    expect(read.listEnquiries).not.toHaveBeenCalled();
  });

  it("is off when the read fails, throws or is too slow", async () => {
    expect(await composeArtEnquiryReplyDot(SIGNED_IN, portal({ status: "failed" }) as never)).toBe(
      false,
    );
    const throwing = { listEnquiries: vi.fn().mockRejectedValue(new Error("down")) };
    expect(await composeArtEnquiryReplyDot(SIGNED_IN, throwing as never)).toBe(false);
    const slow = { listEnquiries: vi.fn(() => new Promise(() => {})) };
    expect(await composeArtEnquiryReplyDot(SIGNED_IN, slow as never, 10)).toBe(false);
  });
});
