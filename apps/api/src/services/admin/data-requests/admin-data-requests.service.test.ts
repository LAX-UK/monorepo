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
  const accounts = {
    findByEmail: vi.fn(async (_email: string) => ({
      subjectId: "user-9",
      name: "Lena Fischer",
      status: "active",
    })),
  };
  const enquiryErasure = {
    eraseByEmail: vi.fn(async (_input: unknown) => ({
      ok: true as const,
      enquiries: 2,
      notes: 1,
      attachments: 0,
      held: 1,
    })),
  };
  return {
    service: new AdminDataRequestsService({
      identity,
      audit,
      accounts,
      enquiryErasure: enquiryErasure as never,
    }),
    identity,
    audit,
    accounts,
    enquiryErasure,
    calls,
  };
}

describe("AdminDataRequestsService", () => {
  it("finds an account by one exact, lower-cased email address and writes no audit row", async () => {
    const { service, accounts, audit } = setup();
    const found = await service.findAccount("  Lena@North.com ");
    expect(accounts.findByEmail).toHaveBeenCalledWith("lena@north.com");
    expect(found?.subjectId).toBe("user-9");
    expect(audit.record).not.toHaveBeenCalled();
  });

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

describe("AdminDataRequestsService.eraseEnquiries", () => {
  const body = { confirmation: "lena@north.com", reason: "Asked to be forgotten" };
  const record = (over: Record<string, unknown> = {}) => ({
    ok: true as const,
    value: {
      request: { reference: "DR-0007", kind: "manual", status: "in_progress" },
      person: { email: "lena@north.com" },
      ownRequest: false,
      ...over,
    } as never,
  });

  it("erases by the request's own address, names the request and records it on the timeline", async () => {
    const { service, identity, enquiryErasure, audit } = setup();
    (identity.record as ReturnType<typeof vi.fn>).mockResolvedValueOnce(record());
    const outcome = await service.eraseEnquiries("DR-0007", body, "staff-1");
    expect(outcome).toEqual({
      ok: true,
      value: { enquiries: 2, notes: 1, attachments: 0, held: 1 },
    });
    expect(enquiryErasure.eraseByEmail).toHaveBeenCalledWith({
      email: "lena@north.com",
      confirmation: "lena@north.com",
      reason: "Asked to be forgotten",
      actorUserId: "staff-1",
      requestReference: "DR-0007",
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: "enquiries_erased",
      reference: "DR-0007",
      actorUserId: "staff-1",
    });
  });

  it.each([
    ["a download", { request: { reference: "DL-7F3C1A", kind: "download", status: "ready" } }],
    [
      "a request waiting for ID",
      { request: { reference: "DR-0007", kind: "manual", status: "waiting_for_id" } },
    ],
    ["a closed request", { request: { reference: "DR-0007", kind: "manual", status: "closed" } }],
  ])("refuses %s and erases nothing", async (_name, over) => {
    const { service, identity, enquiryErasure, audit } = setup();
    (identity.record as ReturnType<typeof vi.fn>).mockResolvedValueOnce(record(over));
    expect(await service.eraseEnquiries("DR-0007", body, "staff-1")).toEqual({
      ok: false,
      status: 409,
      error: "erasure_not_allowed",
    });
    expect(enquiryErasure.eraseByEmail).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("refuses a request about the signed-in person, and one with no email address", async () => {
    const { service, identity, enquiryErasure } = setup();
    const mock = identity.record as ReturnType<typeof vi.fn>;
    mock.mockResolvedValueOnce(record({ ownRequest: true }));
    expect(await service.eraseEnquiries("DR-0007", body, "staff-1")).toMatchObject({
      status: 403,
    });
    mock.mockResolvedValueOnce(record({ person: { email: null } }));
    expect(await service.eraseEnquiries("DR-0007", body, "staff-1")).toMatchObject({
      status: 422,
      error: "no_email",
    });
    expect(enquiryErasure.eraseByEmail).not.toHaveBeenCalled();
  });

  it("passes Identity's refusal back and does not record a failed confirmation", async () => {
    const { service, identity, enquiryErasure, audit } = setup();
    const mock = identity.record as ReturnType<typeof vi.fn>;
    mock.mockResolvedValueOnce({ ok: false, status: 404, error: "not_found" });
    expect(await service.eraseEnquiries("DR-0099", body, "staff-1")).toEqual({
      ok: false,
      status: 404,
      error: "not_found",
    });
    mock.mockResolvedValueOnce(record());
    enquiryErasure.eraseByEmail.mockResolvedValueOnce({
      ok: false,
      error: "confirmation_mismatch",
    } as never);
    expect(await service.eraseEnquiries("DR-0007", body, "staff-1")).toEqual({
      ok: false,
      status: 422,
      error: "confirmation_mismatch",
    });
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
