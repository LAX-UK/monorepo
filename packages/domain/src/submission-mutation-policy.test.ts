import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  SUBMISSION_MUTATIONS,
  type SubmissionMutation,
  type SubmissionMutationDenial,
  submissionMutationPolicy,
} from "./submission-mutation-policy.js";

const ME = "user-me";
const COLLEAGUE = "user-colleague";

type Outcome = "allow" | SubmissionMutationDenial;
type Row = { own: Outcome; other: Outcome };

const CHANGE_ANY: Row = { own: "allow", other: "allow" };
const CHANGE_OWN: Row = { own: "allow", other: "not_sender" };
const NONE: Row = { own: "role", other: "role" };

/**
 * Every role × change × whose submission, written out so a change to any cell is a visible test
 * change. Owners and admins change any; consignors change and withdraw their own; finance,
 * viewers and buyer agents change nothing.
 */
const EXPECTED: Record<LegalEntityMemberRole, Record<SubmissionMutation, Row>> = {
  owner: {
    edit: CHANGE_ANY,
    submit: CHANGE_ANY,
    attach_document: CHANGE_ANY,
    delete_document: CHANGE_ANY,
    withdraw: CHANGE_ANY,
    message: CHANGE_ANY,
  },
  admin: {
    edit: CHANGE_ANY,
    submit: CHANGE_ANY,
    attach_document: CHANGE_ANY,
    delete_document: CHANGE_ANY,
    withdraw: CHANGE_ANY,
    message: CHANGE_ANY,
  },
  consignor: {
    edit: CHANGE_OWN,
    submit: CHANGE_OWN,
    attach_document: CHANGE_OWN,
    delete_document: CHANGE_OWN,
    withdraw: CHANGE_OWN,
    message: CHANGE_OWN,
  },
  finance: {
    edit: NONE,
    submit: NONE,
    attach_document: NONE,
    delete_document: NONE,
    withdraw: NONE,
    message: NONE,
  },
  viewer: {
    edit: NONE,
    submit: NONE,
    attach_document: NONE,
    delete_document: NONE,
    withdraw: NONE,
    message: NONE,
  },
  buyer_agent: {
    edit: NONE,
    submit: NONE,
    attach_document: NONE,
    delete_document: NONE,
    withdraw: NONE,
    message: NONE,
  },
};

function outcome(
  role: LegalEntityMemberRole,
  sender: string | null,
  mutation: SubmissionMutation,
  isImpersonation = false,
): Outcome {
  const decision = submissionMutationPolicy(
    { userId: ME, member: { role, isImpersonation } },
    { submittedByUserId: sender },
    mutation,
  );
  return decision.allowed ? "allow" : decision.reason;
}

const cases = legalEntityMemberRoles.flatMap((role) =>
  SUBMISSION_MUTATIONS.map((mutation) => [role, mutation] as const),
);

describe("submissionMutationPolicy", () => {
  it.each(cases)("%s: %s on their own and on a colleague's submission", (role, mutation) => {
    const expected = EXPECTED[role][mutation];
    expect(outcome(role, ME, mutation)).toBe(expected.own);
    expect(outcome(role, COLLEAGUE, mutation)).toBe(expected.other);
  });

  it("treats a submission with no recorded sender as someone else's", () => {
    expect(outcome("consignor", null, "edit")).toBe("not_sender");
    expect(outcome("admin", null, "edit")).toBe("allow");
  });

  it.each(cases)("makes support staff viewing as the client read-only (%s, %s)", (role, m) => {
    expect(outcome(role, ME, m, true)).toBe("read_only");
  });

  it("lets the holder of a personal account make every change", () => {
    for (const mutation of SUBMISSION_MUTATIONS) {
      expect(submissionMutationPolicy(null, { submittedByUserId: null }, mutation)).toEqual({
        allowed: true,
      });
    }
  });

  it("explains every refusal in words", () => {
    const withdraw = submissionMutationPolicy(
      { userId: ME, member: { role: "finance" } },
      { submittedByUserId: ME },
      "withdraw",
    );
    expect(withdraw).toMatchObject({
      allowed: false,
      message: "Only an owner or admin can withdraw this consignment.",
    });
    const other = submissionMutationPolicy(
      { userId: ME, member: { role: "consignor" } },
      { submittedByUserId: COLLEAGUE },
      "edit",
    );
    expect(other).toMatchObject({
      allowed: false,
      message: "Only the person who sent this work, or an owner or admin, can change it.",
    });
    const viewer = submissionMutationPolicy(
      { userId: ME, member: { role: "viewer" } },
      { submittedByUserId: ME },
      "submit",
    );
    expect(viewer).toMatchObject({
      allowed: false,
      message: "Your role can follow this consignment but not change it.",
    });
  });
});
