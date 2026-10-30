import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ACCESS_ACCOUNT,
  buildAccessRequestService,
} from "../../testing/in-memory-access-requests.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";

const actor = (role: LegalEntityMemberRole, over: Partial<OrganisationMemberActor> = {}) => ({
  userId: `${role}-1`,
  legalEntityId: ACCESS_ACCOUNT,
  role,
  ...over,
});

describe("AccessRequestService.ask", () => {
  it("opens a request once, tells the deciders and records it", async () => {
    const { service, notifier, events } = buildAccessRequestService();
    const first = (
      await service.ask(actor("viewer"), { role: "buyer_agent", reason: "I bid at Spring sale" })
    )._unsafeUnwrap();
    expect(first.created).toBe(true);
    expect(notifier.requested).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "legal_entity.access_requested",
        aggregateId: ACCESS_ACCOUNT,
        payload: expect.objectContaining({ requested_role: "buyer_agent" }),
      }),
    );

    const again = (
      await service.ask(actor("viewer"), { role: "buyer_agent", reason: "Asking again" })
    )._unsafeUnwrap();
    expect(again).toMatchObject({ created: false, request: { id: first.request.id } });
    expect(notifier.requested).toHaveBeenCalledTimes(1);
  });

  it("asks for a capability the role lacks", async () => {
    const { service } = buildAccessRequestService();
    const result = await service.ask(actor("finance"), {
      capability: "entity.bid.place",
      reason: "To bid for the gallery",
    });
    expect(result._unsafeUnwrap().request.requestedCapability).toBe("entity.bid.place");
  });

  it("refuses what is already held, unknown capabilities and an impersonating admin", async () => {
    const { service } = buildAccessRequestService();
    expect(
      (await service.ask(actor("finance"), { role: "finance", reason: "x y z" }))._unsafeUnwrapErr()
        .code,
    ).toBe("access_already_held");
    expect(
      (
        await service.ask(actor("viewer"), { capability: "entity.anything", reason: "x y z" })
      )._unsafeUnwrapErr().code,
    ).toBe("access_unknown_capability");
    expect(
      (
        await service.ask(actor("owner", { isImpersonation: true }), {
          role: "admin",
          reason: "x y z",
        })
      )._unsafeUnwrapErr().status,
    ).toBe(403);
  });
});

describe("AccessRequestService decisions", () => {
  async function asked(role: LegalEntityMemberRole = "viewer") {
    const built = buildAccessRequestService();
    const { request } = (
      await built.service.ask(actor(role), { role: "buyer_agent", reason: "I bid for us" })
    )._unsafeUnwrap();
    return { ...built, request };
  }

  it("approves by giving the role through the member rules, then tells the requester", async () => {
    const { service, request, roles, notifier, events } = await asked();
    const approved = (await service.approve(actor("admin"), request.id, {}))._unsafeUnwrap();
    expect(approved).toMatchObject({ status: "approved", grantedRole: "buyer_agent" });
    expect(roles.change).toHaveBeenCalledWith({
      actingUserId: "admin-1",
      legalEntityId: ACCESS_ACCOUNT,
      memberId: "member-viewer",
      role: "buyer_agent",
    });
    expect(notifier.decided).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
    expect(events.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "legal_entity.access_request_decided",
        payload: expect.objectContaining({ decision: "approved", granted_role: "buyer_agent" }),
      }),
    );
  });

  it("leaves the request open when the member rules refuse the role change", async () => {
    const { service, request, roles, store } = await asked();
    roles.change.mockResolvedValueOnce({
      ok: false,
      error: { code: "forbidden_role", status: 403, message: "No" },
    } as never);
    const result = await service.approve(actor("admin"), request.id, {});
    expect(result._unsafeUnwrapErr().code).toBe("forbidden_role");
    expect(store.rows[0]?.status).toBe("pending");
  });

  it("needs a role holding the capability for a capability request", async () => {
    const { service } = buildAccessRequestService();
    const { request } = (
      await service.ask(actor("finance"), { capability: "entity.bid.place", reason: "To bid" })
    )._unsafeUnwrap();
    expect((await service.approve(actor("owner"), request.id, {}))._unsafeUnwrapErr().code).toBe(
      "access_role_required",
    );
    expect(
      (await service.approve(actor("owner"), request.id, { role: "viewer" }))._unsafeUnwrapErr()
        .code,
    ).toBe("access_role_lacks_capability");
    expect(
      (await service.approve(actor("owner"), request.id, { role: "buyer_agent" }))._unsafeUnwrap()
        .grantedRole,
    ).toBe("buyer_agent");
  });

  it("declines with a note and tells the requester; a decided request stays decided", async () => {
    const { service, request, notifier, roles } = await asked();
    const declined = (
      await service.decline(actor("owner"), request.id, { note: "Use your own account" })
    )._unsafeUnwrap();
    expect(declined).toMatchObject({ status: "declined", decisionNote: "Use your own account" });
    expect(roles.change).not.toHaveBeenCalled();
    expect(notifier.decided).toHaveBeenCalledTimes(1);
    expect((await service.approve(actor("admin"), request.id, {}))._unsafeUnwrapErr().status).toBe(
      409,
    );
  });

  it("never lets a requester decide their own request, nor non-deciders decide", async () => {
    const { service } = buildAccessRequestService();
    const { request } = (
      await service.ask(actor("admin"), { role: "owner", reason: "Run the account" })
    )._unsafeUnwrap();
    expect((await service.approve(actor("admin"), request.id, {}))._unsafeUnwrapErr().code).toBe(
      "access_own_request",
    );
    for (const role of ["finance", "consignor", "viewer", "buyer_agent"] as const) {
      expect((await service.decline(actor(role), request.id, {}))._unsafeUnwrapErr().code).toBe(
        "access_not_decider",
      );
    }
  });

  it("lets only the requester withdraw, and only while it waits", async () => {
    const { service, request, notifier } = await asked();
    expect((await service.withdraw(actor("finance"), request.id))._unsafeUnwrapErr().status).toBe(
      404,
    );
    expect((await service.withdraw(actor("viewer"), request.id))._unsafeUnwrap().status).toBe(
      "withdrawn",
    );
    expect(notifier.decided).not.toHaveBeenCalled();
    expect((await service.withdraw(actor("viewer"), request.id))._unsafeUnwrapErr().status).toBe(
      409,
    );
  });

  it("shows deciders every request and other members their own", async () => {
    const { service } = await asked();
    await service.ask(actor("consignor"), { role: "admin", reason: "Help run it" });
    expect((await service.list(actor("owner"), {}))._unsafeUnwrap()).toHaveLength(2);
    expect(
      (await service.list(actor("consignor"), {}))._unsafeUnwrap().map((r) => r.requestedRole),
    ).toEqual(["admin"]);
  });

  it("can only decline when the requester has left", async () => {
    const { service, request, store } = await asked();
    store.members.delete("viewer-1");
    expect((await service.approve(actor("owner"), request.id, {}))._unsafeUnwrapErr().code).toBe(
      "access_requester_left",
    );
    expect((await service.decline(actor("owner"), request.id, {}))._unsafeUnwrap().status).toBe(
      "declined",
    );
  });
});
