import type { ItemSubmission, LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { consignmentActionsVm } from "./consignment-actions.vm";

const ME = "user-me";

function actions(
  role: LegalEntityMemberRole | null,
  status: ItemSubmission["status"],
  sender: string | null = ME,
  isImpersonation = false,
) {
  return consignmentActionsVm({
    actor: role ? { userId: ME, member: { role, isImpersonation } } : null,
    submission: { status, submittedByUserId: sender },
  });
}

const ALL = { canEdit: true, canSubmit: true, canWithdraw: true, canManageDocuments: true };
const NONE = { canEdit: false, canSubmit: false, canWithdraw: false, canManageDocuments: false };

describe("consignmentActionsVm", () => {
  it.each([
    ["owner", ME, ALL],
    ["admin", "someone-else", ALL],
    ["consignor", ME, ALL],
    ["consignor", "someone-else", NONE],
    ["finance", ME, NONE],
    ["viewer", "someone-else", NONE],
  ] as const)("a %s on a draft sent by %s", (role, sender, expected) => {
    expect(actions(role, "draft", sender)).toEqual(expected);
  });

  it("follows the state: a submission with the specialist cannot be edited or sent", () => {
    expect(actions("owner", "under_review")).toEqual({
      canEdit: false,
      canSubmit: false,
      canWithdraw: true,
      canManageDocuments: true,
    });
    expect(actions("owner", "converted").canWithdraw).toBe(false);
    expect(actions("owner", "changes_requested")).toMatchObject({
      canEdit: true,
      canSubmit: false,
    });
  });

  it("lets the holder of a personal account do everything the state allows", () => {
    expect(actions(null, "draft", null)).toEqual(ALL);
  });

  it("offers support staff viewing as the client nothing", () => {
    expect(actions("admin", "draft", ME, true)).toEqual(NONE);
  });
});
