import type { AccessRequestRow } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification.factory.js";
import { AccessRequestNotifier } from "./access-request-adapters.js";

const request: AccessRequestRow = {
  id: "req-1",
  legalEntityId: "org-1",
  requesterUserId: "tom",
  requesterName: "Tom Whitfield",
  requestedRole: "buyer_agent",
  requestedCapability: null,
  reason: "For the November sale.",
  status: "pending",
  grantedRole: null,
  decidedByUserId: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: new Date("2026-11-01T10:00:00Z"),
};

function setup(nameOf = vi.fn(async () => "Northbank Gallery")) {
  const dispatch = vi.fn(async (_userId: string, _payload: unknown) => undefined);
  const notifier = new AccessRequestNotifier(
    { listUserIdsForAudience: vi.fn(async () => ["maya", "tom", "daniel"]) } as never,
    { dispatch },
    new NotificationFactory(),
    { nameOf },
  );
  return { notifier, dispatch };
}

describe("AccessRequestNotifier", () => {
  it("tells every owner and admin but the requester, with the email's words", async () => {
    const { notifier, dispatch } = setup();
    await notifier.requested(request);
    expect(dispatch.mock.calls.map((call) => call[0])).toEqual(["maya", "daniel"]);
    expect(dispatch).toHaveBeenCalledWith(
      "maya",
      expect.objectContaining({
        type: "access_requested",
        legalEntityId: "org-1",
        meta: expect.objectContaining({
          organisationName: "Northbank Gallery",
          accessRequest: {
            requesterName: "Tom Whitfield",
            requested: "the buyer agent role",
            reason: "For the November sale.",
          },
          emailIdempotencyKey: "access-request:req-1:pending:maya",
        }),
      }),
    );
  });

  it("tells the requester the decision, even when the organisation's name can't be read", async () => {
    const { notifier, dispatch } = setup(
      vi.fn(async () => {
        throw new Error("db");
      }),
    );
    await notifier.decided({
      ...request,
      status: "approved",
      grantedRole: "buyer_agent",
      decisionNote: "Welcome.",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      "tom",
      expect.objectContaining({
        type: "access_request_decided",
        meta: expect.objectContaining({
          accessRequest: expect.objectContaining({
            approved: true,
            grantedRole: "buyer agent",
            note: "Welcome.",
          }),
        }),
      }),
    );
  });
});
