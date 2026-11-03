import { describe, expect, it, vi } from "vitest";
import type { IIdentityDataRequestsClient } from "../../interfaces/identity-data-requests-client.js";
import { AdminDataRequestsService } from "./admin-data-requests.service.js";
import { DomainEventDataRequestAuditTrail } from "./data-request-audit-trail.js";

const RECORD = { request: { reference: "DR-0007" } } as never;

function setup() {
  const calls: string[] = [];
  const identity = {
    list: vi.fn(async () => ({ items: [], nextCursor: null })),
    summary: vi.fn(async () => ({}) as never),
    record: vi.fn(async () => {
      calls.push("identity");
      return { ok: true as const, value: RECORD };
    }),
    create: vi.fn(async () => {
      calls.push("identity");
      return { ok: true as const, value: RECORD };
    }),
    patch: vi.fn(async () => {
      calls.push("identity");
      return { ok: true as const, value: RECORD };
    }),
    extend: vi.fn(async () => {
      calls.push("identity");
      return { ok: true as const, value: RECORD };
    }),
    close: vi.fn(async () => {
      calls.push("identity");
      return { ok: false as const, status: 409, error: "stale_version" };
    }),
    continueDownload: vi.fn(async () => {
      calls.push("identity");
      return { ok: true as const, value: RECORD };
    }),
  } satisfies IIdentityDataRequestsClient;
  const audit = {
    record: vi.fn(async (_input: unknown) => {
      calls.push("audit");
    }),
  };
  return { service: new AdminDataRequestsService({ identity, audit }), identity, audit, calls };
}

describe("AdminDataRequestsService", () => {
  it("audits opening a record before showing it", async () => {
    const { service, audit, calls } = setup();
    await service.record("DR-0007", "staff-1");
    expect(audit.record).toHaveBeenCalledWith({
      action: "viewed",
      reference: "DR-0007",
      actorUserId: "staff-1",
    });
    expect(calls).toEqual(["audit", "identity"]);
  });

  it("does not show a record when the audit cannot be written", async () => {
    const { service, audit, identity } = setup();
    audit.record.mockRejectedValueOnce(new Error("db down"));
    await expect(service.record("DR-0007", "staff-1")).rejects.toThrow("db down");
    expect(identity.record).not.toHaveBeenCalled();
  });

  it("audits each action, then calls Identity with the staff member as the actor", async () => {
    const { service, audit, identity, calls } = setup();
    await service.patch("DR-0007", { version: 1, notes: "x" }, "staff-1");
    await service.extend(
      "DR-0007",
      {
        version: 1,
        months: 1,
        reason: "complex",
        note: "x",
        personToldOn: "2026-11-01",
        personToldVia: "email",
      },
      "staff-1",
    );
    await service.continueDownload("DL-7F3C1A", "staff-1");
    expect(audit.record.mock.calls.map(([input]) => (input as { action: string }).action)).toEqual([
      "updated",
      "extended",
      "continued",
    ]);
    expect(identity.patch).toHaveBeenCalledWith("DR-0007", {
      version: 1,
      notes: "x",
      actorSubjectId: "staff-1",
    });
    expect(identity.continueDownload).toHaveBeenCalledWith("DL-7F3C1A", "staff-1");
    expect(calls).toEqual(["audit", "identity", "audit", "identity", "audit", "identity"]);
  });

  it("passes Identity's refusal back after auditing the attempt", async () => {
    const { service, audit } = setup();
    const outcome = await service.close("DR-0007", { version: 1, outcome: "sent" }, "staff-1");
    expect(outcome).toEqual({ ok: false, status: 409, error: "stale_version" });
    expect(audit.record).toHaveBeenCalledWith({
      action: "closed",
      reference: "DR-0007",
      actorUserId: "staff-1",
    });
  });

  it("audits a new request once it has its reference", async () => {
    const { service, audit, calls } = setup();
    await service.create(
      {
        person: { kind: "account", subjectId: "user_1" },
        reason: "full_copy",
        channel: "email",
        receivedOn: "2026-11-02",
        identity: "confirmed",
        products: ["account"],
      },
      "staff-1",
    );
    expect(audit.record).toHaveBeenCalledWith({
      action: "logged",
      reference: "DR-0007",
      actorUserId: "staff-1",
    });
    expect(calls).toEqual(["identity", "audit"]);
  });

  it("does not audit a request that was not created", async () => {
    const { service, audit, identity } = setup();
    (identity.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: "received_in_future",
    });
    await service.create(
      {
        person: { kind: "account", subjectId: "u" },
        reason: "full_copy",
        channel: "email",
        receivedOn: "2026-12-01",
        identity: "confirmed",
        products: ["bid"],
      },
      "staff-1",
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("lists and counts without auditing: the list is masked and the badge polls", async () => {
    const { service, audit } = setup();
    await service.list({ view: "open", sort: "due" });
    await service.summary();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe("DomainEventDataRequestAuditTrail", () => {
  it("writes the actor, the reference and the action, and nothing about the person", async () => {
    const publish = vi.fn(async () => undefined);
    const trail = new DomainEventDataRequestAuditTrail({ publish, withTx: vi.fn() });
    await trail.record({ action: "extended", reference: "DR-0007", actorUserId: "staff-1" });
    expect(publish).toHaveBeenCalledWith({
      aggregateType: "data_request",
      aggregateId: "DR-0007",
      eventType: "data_request.extended",
      payload: { reference: "DR-0007" },
      producer: "apps/api",
      actorUserId: "staff-1",
    });
  });
});
