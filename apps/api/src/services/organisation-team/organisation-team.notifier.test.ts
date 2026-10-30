import { describe, expect, it, vi } from "vitest";
import { OrganisationTeamNotifier } from "./organisation-team.notifier.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

function setup() {
  const dispatch = vi.fn(async (_userId: string, _notice: unknown) => undefined);
  const listUserIdsForAudience = vi.fn(async (_id: string, audience: string) =>
    audience === "admin" ? ["owner-1", "admin-1"] : ["owner-1", "admin-1", "finance-1"],
  );
  const notifier = new OrganisationTeamNotifier({
    dispatcher: { dispatch },
    recipients: { listUserIdsForAudience },
    people: { nameOf: async () => "Max Member" },
  });
  return { notifier, dispatch, listUserIdsForAudience };
}

describe("OrganisationTeamNotifier", () => {
  it("tells owners and admins that a member left", async () => {
    const { notifier, dispatch, listUserIdsForAudience } = setup();
    await notifier.memberLeft({ legalEntityId: ENTITY, memberUserId: "m-1" });
    expect(listUserIdsForAudience).toHaveBeenCalledWith(ENTITY, "admin");
    expect(dispatch.mock.calls.map(([userId]) => userId)).toEqual(["owner-1", "admin-1"]);
    expect(dispatch).toHaveBeenCalledWith("owner-1", {
      type: "organisation_member_left",
      title: "Max Member left the organisation",
      message: "Their automatic bids for the organisation have stopped. Bids already placed stand.",
      legalEntityId: ENTITY,
    });
  });

  it("tells owners, admins and finance that the payout bank account changed", async () => {
    const { notifier, dispatch, listUserIdsForAudience } = setup();
    await notifier.bankChanged({
      legalEntityId: ENTITY,
      organisationName: "Northbank Gallery",
      bankLast4: "4242",
    });
    expect(listUserIdsForAudience).toHaveBeenCalledWith(ENTITY, "finance");
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenCalledWith("finance-1", {
      type: "payout_bank_changed",
      title: "The payout bank account for Northbank Gallery changed",
      message:
        "Payouts now go to the account ending 4242. If nobody at Northbank Gallery made this change, contact us straight away.",
      meta: { organisationName: "Northbank Gallery", bankLast4: "4242" },
      legalEntityId: ENTITY,
    });
  });

  it("never fails the change it reports when delivery fails", async () => {
    const { notifier, dispatch } = setup();
    dispatch.mockRejectedValue(new Error("down"));
    await expect(
      notifier.memberLeft({ legalEntityId: ENTITY, memberUserId: "m-1" }),
    ).resolves.toBeUndefined();
  });
});
