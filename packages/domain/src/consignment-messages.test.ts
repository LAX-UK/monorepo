import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS,
  CONSIGNMENT_MESSAGE_MAX_LENGTH,
  ORGANISATION_MESSAGES_PAUSED,
  consignmentMessageProblem,
  consignmentThreadAccess,
  normaliseConsignmentMessageBody,
  otherSide,
  threadAwaitsStaff,
} from "./consignment-messages.js";

const ME = "user-me";
const OTHER = "user-other";

function access(
  role: LegalEntityMemberRole,
  sender: string | null,
  options: { isImpersonation?: boolean; status?: "approved" | "restricted" | "archived" } = {},
) {
  return consignmentThreadAccess({
    actor: { userId: ME, member: { role, isImpersonation: options.isImpersonation ?? false } },
    submission: { submittedByUserId: sender },
    organisationStatus: options.status ?? "approved",
  });
}

type Row = { read: boolean; write: boolean; marksRead: boolean };

/**
 * Every role on a consignment they sent and on one a colleague sent. Owners and admins write on
 * any; a consignor writes on their own and does not see a colleague's; the roles that follow
 * consignments read every attributed one and never write.
 */
const EXPECTED: Record<LegalEntityMemberRole, { own: Row; other: Row }> = {
  owner: {
    own: { read: true, write: true, marksRead: true },
    other: { read: true, write: true, marksRead: true },
  },
  admin: {
    own: { read: true, write: true, marksRead: true },
    other: { read: true, write: true, marksRead: true },
  },
  consignor: {
    own: { read: true, write: true, marksRead: true },
    other: { read: false, write: false, marksRead: false },
  },
  finance: {
    own: { read: true, write: false, marksRead: false },
    other: { read: true, write: false, marksRead: false },
  },
  viewer: {
    own: { read: true, write: false, marksRead: false },
    other: { read: true, write: false, marksRead: false },
  },
  // A buyer agent cannot send works, so "their own" never happens; the visibility rule says own.
  buyer_agent: {
    own: { read: true, write: false, marksRead: false },
    other: { read: false, write: false, marksRead: false },
  },
};

describe("consignmentThreadAccess", () => {
  for (const role of legalEntityMemberRoles) {
    for (const whose of ["own", "other"] as const) {
      it(`${role} on ${whose === "own" ? "their own" : "a colleague's"} consignment`, () => {
        const result = access(role, whose === "own" ? ME : OTHER);
        expect({
          read: result.read,
          write: result.write.allowed,
          marksRead: result.marksRead,
        }).toEqual(EXPECTED[role][whose]);
      });
    }
  }

  it("says why a viewer cannot write, in words", () => {
    const result = access("viewer", OTHER);
    expect(result.write).toEqual({
      allowed: false,
      reason: "role",
      message:
        "Your role can read these messages. Owners, admins and the person who sent this work can write.",
    });
  });

  it("support staff viewing the account read but neither write nor clear the task", () => {
    const result = access("owner", ME, { isImpersonation: true });
    expect(result.read).toBe(true);
    expect(result.write).toMatchObject({ allowed: false, reason: "read_only" });
    expect(result.marksRead).toBe(false);
  });

  it("a restricted or archived organisation keeps the thread to read and pauses writing", () => {
    for (const status of ["restricted", "archived"] as const) {
      const result = access("owner", ME, { status });
      expect(result.read).toBe(true);
      expect(result.write).toEqual({
        allowed: false,
        reason: "organisation",
        message: ORGANISATION_MESSAGES_PAUSED.message,
      });
      // The task is hidden while writing is paused, so reading still clears it.
      expect(result.marksRead).toBe(true);
    }
  });

  it("the holder of a person's own account reads and writes", () => {
    const result = consignmentThreadAccess({
      actor: null,
      submission: { submittedByUserId: null },
      organisationStatus: null,
    });
    expect(result).toEqual({ read: true, write: { allowed: true }, marksRead: true });
  });
});

describe("consignmentMessageProblem", () => {
  it("needs words or a file", () => {
    expect(consignmentMessageProblem({ body: "  \n ", attachmentIds: [] })?.code).toBe(
      "message_empty",
    );
    expect(consignmentMessageProblem({ body: "", attachmentIds: ["u1"] })).toBeNull();
    expect(consignmentMessageProblem({ body: "Thank you", attachmentIds: [] })).toBeNull();
  });

  it("limits the length and the files", () => {
    expect(
      consignmentMessageProblem({
        body: "a".repeat(CONSIGNMENT_MESSAGE_MAX_LENGTH + 1),
        attachmentIds: [],
      })?.code,
    ).toBe("message_too_long");
    const many = Array.from({ length: CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS + 1 }, (_, i) => `u${i}`);
    expect(consignmentMessageProblem({ body: "x", attachmentIds: many })?.code).toBe(
      "message_too_many_attachments",
    );
    expect(consignmentMessageProblem({ body: "x", attachmentIds: ["u1", "u1"] })?.code).toBe(
      "message_duplicate_attachment",
    );
  });
});

describe("message text and sides", () => {
  it("normalises line endings, trailing spaces and blank runs", () => {
    expect(normaliseConsignmentMessageBody("  Hello \r\n\r\n\r\n\r\nThe frame  \n")).toBe(
      "Hello\n\nThe frame",
    );
  });

  it("a thread waits for LAX while the client wrote last", () => {
    expect(threadAwaitsStaff("client")).toBe(true);
    expect(threadAwaitsStaff("staff")).toBe(false);
    expect(threadAwaitsStaff(null)).toBe(false);
    expect(otherSide("client")).toBe("staff");
    expect(otherSide("staff")).toBe("client");
  });
});
