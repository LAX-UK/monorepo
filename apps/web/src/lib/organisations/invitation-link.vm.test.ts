import { describe, expect, it } from "vitest";
import { buildInvitationLinkView } from "./invitation-link.vm";

const PAGE = "/organisations/invitations/accept/tok-1";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

describe("buildInvitationLinkView", () => {
  it("offers to accept an open invitation, naming who, where and the role", () => {
    const view = buildInvitationLinkView({
      preview: {
        state: "open",
        legalEntityId: ORG_ID,
        organisationName: "Northbank Gallery",
        role: "buyer_agent",
        inviterName: "Sam Okafor",
        expiresAt: "2026-11-05T12:00:00.000Z",
      },
      pagePath: PAGE,
      failedBefore: false,
    });
    expect(view.title).toBe("Join Northbank Gallery");
    expect(view.description).toContain(
      "Sam Okafor invited you to join Northbank Gallery as Buyer agent.",
    );
    expect(view.description).toContain("expires on 5 Nov 2026");
    expect(view.accept).toEqual({ label: "Accept invitation" });
    expect(view.retryNotice).toBeNull();
  });

  it("asks to try again after an accept the API could not complete", () => {
    const view = buildInvitationLinkView({
      preview: {
        state: "open",
        legalEntityId: ORG_ID,
        organisationName: "Northbank Gallery",
        role: "admin",
        inviterName: null,
        expiresAt: "2026-11-05T12:00:00.000Z",
      },
      pagePath: PAGE,
      failedBefore: true,
    });
    expect(view.description.startsWith("You're invited to join Northbank Gallery as Admin.")).toBe(
      true,
    );
    expect(view.retryNotice).toMatch(/couldn't accept the invitation just now/);
  });

  it("opens the organisation for someone already a member", () => {
    const view = buildInvitationLinkView({
      preview: {
        state: "already_member",
        legalEntityId: ORG_ID,
        organisationName: "Northbank Gallery",
      },
      pagePath: PAGE,
      failedBefore: false,
    });
    expect(view.title).toBe("You're already a member of Northbank Gallery");
    expect(view.accept).toBeNull();
    expect(view.primary).toEqual({
      label: "Open Northbank Gallery",
      href: `/switch-account?to=${ORG_ID}&next=%2Fhome`,
    });
  });

  it.each([
    [
      { state: "expired", organisationName: "Northbank Gallery" } as const,
      "This invitation has expired",
    ],
    [{ state: "closed" } as const, "This invitation is no longer open"],
    [{ state: "other_email" } as const, "This invitation is for another email address"],
    [{ state: "unavailable" } as const, "We couldn't open this invitation"],
  ])("explains %o with nothing to accept", (preview, title) => {
    const view = buildInvitationLinkView({ preview, pagePath: PAGE, failedBefore: false });
    expect(view.title).toBe(title);
    expect(view.accept).toBeNull();
  });

  it("lets the person retry a page that could not be read", () => {
    const view = buildInvitationLinkView({
      preview: { state: "unavailable" },
      pagePath: PAGE,
      failedBefore: false,
    });
    expect(view.primary).toEqual({ label: "Try again", href: PAGE });
  });
});
