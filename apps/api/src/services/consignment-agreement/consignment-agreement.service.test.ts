import { CONSIGNMENT_AGREEMENT_TERMS_VERSION } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import { InMemoryConsignmentAgreements } from "../../testing/in-memory-consignment-agreements.js";
import { ConsignmentAgreementService } from "./consignment-agreement.service.js";

const proposedAt = new Date("2026-10-01T09:00:00Z");
const day = (n: number) => new Date(proposedAt.getTime() + n * 24 * 60 * 60 * 1000);

function setup() {
  const agreements = new InMemoryConsignmentAgreements();
  agreements.seed({ submissionId: "sub-1", legalEntityId: "le-1", proposedAt });
  const dispatch = vi.fn().mockResolvedValue(undefined);
  let now = day(0);
  const service = new ConsignmentAgreementService({
    agreements,
    submissions: { findById: vi.fn() },
    people: { findById: vi.fn() },
    dispatcher: { dispatch },
    recipients: { listUserIdsForAudience: vi.fn().mockResolvedValue(["owner-1", "admin-1"]) },
    events: null,
    now: () => now,
  });
  return {
    agreements,
    dispatch,
    service,
    at(n: number) {
      now = day(n);
    },
  };
}

describe("consignment agreement reminders", () => {
  it("sends nothing before day 3", async () => {
    const t = setup();
    t.at(2);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(t.dispatch).not.toHaveBeenCalled();
  });

  it("sends the day 3 reminder once to each seller recipient", async () => {
    const t = setup();
    t.at(3);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 1 });
    expect(t.dispatch).toHaveBeenCalledTimes(2);
    expect(t.dispatch).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        type: "consignment_agreement_reminder",
        submissionId: "sub-1",
        message: expect.stringContaining('"Untitled (Blue)"'),
      }),
    );
    t.at(4);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(t.dispatch).toHaveBeenCalledTimes(2);
  });

  it("sends the day 7 reminder once, then nothing more", async () => {
    const t = setup();
    t.at(3);
    await t.service.sendDueReminders();
    t.at(7);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 1 });
    t.at(8);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    t.at(30);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(t.dispatch).toHaveBeenCalledTimes(4);
  });

  it("sends one reminder, not two, when the job missed day 3", async () => {
    const t = setup();
    t.at(8);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 1 });
    t.at(9);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(t.dispatch).toHaveBeenCalledTimes(2);
  });

  it("never reminds after acceptance", async () => {
    const t = setup();
    await t.agreements.accept({
      submissionId: "sub-1",
      acceptedByUserId: "u1",
      acceptedAt: day(1),
    });
    t.at(3);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    t.at(7);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(t.dispatch).not.toHaveBeenCalled();
  });

  it("never reminds a seller about a proposal without an estimate and terms", async () => {
    const t = setup();
    t.agreements.seed({
      submissionId: "sub-1",
      legalEntityId: "le-1",
      proposedAt,
      estimateLow: null,
      estimateHigh: null,
      commissionPercent: null,
    });
    t.at(8);
    expect(await t.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(t.dispatch).not.toHaveBeenCalled();
  });

  it("is idempotent when two runs overlap", async () => {
    const t = setup();
    t.at(3);
    const [a, b] = await Promise.all([t.service.sendDueReminders(), t.service.sendDueReminders()]);
    expect(a.reminded + b.reminded).toBe(1);
    expect(t.dispatch).toHaveBeenCalledTimes(2);
  });
});

describe("accepting the agreement by account state", () => {
  const owner = {
    userId: "u1",
    legalEntityId: "le-1",
    actor: { role: "owner", userId: "u1", entityId: "le-1" },
  } as never;

  // Each state against what the account may do: only states the domain leaves open accept.
  const cases = [
    ["lead", false],
    ["docs_requested", false],
    ["docs_received", false],
    ["under_review", false],
    ["connect_pending", false],
    ["approved", true],
    ["restricted", false],
    ["rejected", false],
    ["archived", false],
  ] as const;

  it.each(cases)("%s organisation: accepting allowed is %s", async (status, allowed) => {
    const agreements = new InMemoryConsignmentAgreements();
    agreements.seed({
      submissionId: "sub-1",
      legalEntityId: "le-1",
      proposedAt,
      estimateLow: "100.00",
      estimateHigh: "200.00",
      commissionPercent: "15.00",
    });
    const service = new ConsignmentAgreementService({
      agreements,
      submissions: { findById: vi.fn().mockResolvedValue({ id: "sub-1", legalEntityId: "le-1" }) },
      people: { findById: vi.fn().mockResolvedValue({ name: "Owner" }) },
      dispatcher: { dispatch: vi.fn() },
      recipients: null,
      events: null,
      legalEntities: { findById: vi.fn().mockResolvedValue({ kind: "organisation", status }) },
    });
    const result = await service.accept("sub-1", owner, CONSIGNMENT_AGREEMENT_TERMS_VERSION);
    expect(result.isOk()).toBe(allowed);
    if (result.isErr()) expect(result.error.status).toBe(403);
  });
});
