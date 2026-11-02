import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { InMemoryPurchaseProblems } from "../../testing/in-memory-purchase-problems.js";
import {
  BUYING_ACCOUNT,
  InMemoryPurchaseFacts,
  LOTS,
  NOW,
  OTHER_ACCOUNT,
} from "../../testing/in-memory-workspace-buying.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { PurchaseProblemService } from "./purchase-problem.service.js";

const actor = (
  role: LegalEntityMemberRole,
  over: Partial<OrganisationMemberActor> = {},
): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: BUYING_ACCOUNT,
  role,
  ...over,
});

function setup() {
  const problems = new InMemoryPurchaseProblems();
  const publish = vi.fn().mockResolvedValue(undefined);
  const events = { publish, withTx: () => events } as unknown as IDomainEventSink;
  const service = new PurchaseProblemService({
    purchases: new InMemoryPurchaseFacts(),
    problems,
    transactionRunner: { runInTransaction: (fn) => fn({} as never) },
    events,
    now: () => NOW,
  });
  return { service, problems, publish };
}

const input = { category: "damaged", message: "The frame arrived cracked." } as const;

describe("PurchaseProblemService.report", () => {
  it("opens a case on a paid purchase with a reference, and publishes the event once", async () => {
    const { service, problems, publish } = setup();
    const { problem, created } = (
      await service.report(actor("finance"), LOTS.paid, input)
    )._unsafeUnwrap();
    expect(created).toBe(true);
    expect(problem).toMatchObject({
      reference: "PR-3F2A9C1E",
      status: "open",
      category: "damaged",
      reportedAt: NOW,
    });
    expect(problems.rows[0]).toMatchObject({
      lotId: LOTS.paid,
      buyerLegalEntityId: BUYING_ACCOUNT,
      paymentId: "pay-1",
      message: "The frame arrived cracked.",
      reportedByUserId: "finance-1",
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      aggregateType: "purchase_problem",
      aggregateId: problem.id,
      eventType: "purchase_problem.reported",
      payload: { lotId: LOTS.paid, paymentId: "pay-1", category: "damaged" },
      actorUserId: "finance-1",
      actingLegalEntityId: BUYING_ACCOUNT,
    });
  });

  it("keeps what the buyer wrote out of the event", async () => {
    const { service, publish } = setup();
    await service.report(actor("owner"), LOTS.paid, input);
    expect(JSON.stringify(publish.mock.calls)).not.toContain("cracked");
  });

  it("returns the open case when reported again, without a second case or event", async () => {
    const { service, problems, publish } = setup();
    const first = (await service.report(actor("owner"), LOTS.paid, input))._unsafeUnwrap();
    const again = (
      await service.report(actor("admin"), LOTS.paid, { category: "other", message: "Second try." })
    )._unsafeUnwrap();
    expect(again.created).toBe(false);
    expect(again.problem.id).toBe(first.problem.id);
    expect(again.problem.category).toBe("damaged");
    expect(problems.rows).toHaveLength(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("refuses a purchase that is not paid yet", async () => {
    const { service, problems, publish } = setup();
    for (const lot of [LOTS.due, LOTS.overdue]) {
      expect((await service.report(actor("owner"), lot, input))._unsafeUnwrapErr()).toMatchObject({
        code: "problem_purchase_not_paid",
        status: 409,
      });
    }
    expect(problems.rows).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it("refuses a purchase that belongs to another account", async () => {
    const { service } = setup();
    const result = await service.report(
      actor("owner", { legalEntityId: OTHER_ACCOUNT }),
      LOTS.paid,
      input,
    );
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "purchase_not_found", status: 404 });
    expect(
      (
        await service.report(actor("owner"), "aaaaaaaa-0000-4000-8000-0000000000ff", input)
      )._unsafeUnwrapErr().code,
    ).toBe("purchase_not_found");
  });

  it("limits a buyer agent to the purchases they won themselves", async () => {
    const { service } = setup();
    const result = await service.report(actor("buyer_agent"), LOTS.paid, input);
    expect(result._unsafeUnwrapErr().code).toBe("purchase_not_found");
  });

  it("refuses roles that do not follow purchases", async () => {
    const { service, publish } = setup();
    for (const role of ["consignor", "viewer"] as const) {
      expect(
        (await service.report(actor(role), LOTS.paid, input))._unsafeUnwrapErr(),
      ).toMatchObject({
        code: "insufficient_entity_role",
        status: 403,
      });
    }
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("PurchaseProblemService.current", () => {
  it("is null until a report is open, then the report", async () => {
    const { service } = setup();
    expect((await service.current(actor("owner"), LOTS.paid))._unsafeUnwrap()).toBeNull();
    await service.report(actor("owner"), LOTS.paid, input);
    expect((await service.current(actor("finance"), LOTS.paid))._unsafeUnwrap()).toMatchObject({
      reference: "PR-3F2A9C1E",
      status: "open",
    });
  });

  it("does not show another account's report", async () => {
    const { service } = setup();
    await service.report(actor("owner"), LOTS.paid, input);
    const result = await service.current(
      actor("owner", { legalEntityId: OTHER_ACCOUNT }),
      LOTS.paid,
    );
    expect(result._unsafeUnwrapErr().code).toBe("purchase_not_found");
  });
});
