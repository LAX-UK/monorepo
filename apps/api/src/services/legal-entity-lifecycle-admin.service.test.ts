import { describe, expect, it, vi } from "vitest";
import type { LifecycleAdminOp } from "../lib/legal-entity-lifecycle-transitions.js";
import {
  LegalEntityLifecycleAdminService,
  lifecycleDomainEventTypeForOp,
} from "./legal-entity-lifecycle-admin.service.js";

describe("lifecycleDomainEventTypeForOp", () => {
  it.each([
    ["request_docs", "legal_entity.docs_requested"],
    ["start_review", "legal_entity.review_started"],
    ["approve", "legal_entity.approved"],
    ["restrict", "legal_entity.restricted"],
    ["reject", "legal_entity.rejected"],
    ["archive", "legal_entity.archived"],
  ] as const satisfies ReadonlyArray<[LifecycleAdminOp, string]>)(
    "maps op %s to %s",
    (op, expected) => {
      expect(lifecycleDomainEventTypeForOp(op)).toBe(expected);
    },
  );
});

describe("LegalEntityLifecycleAdminService", () => {
  const entityId = "00000000-0000-4000-8000-000000000001";

  const lifecycleCases = [
    {
      op: "request_docs" as const,
      entityStatus: "lead",
      eventType: "legal_entity.docs_requested",
      next: "docs_requested",
      reason: undefined as string | undefined,
    },
    {
      op: "start_review" as const,
      entityStatus: "docs_received",
      eventType: "legal_entity.review_started",
      next: "under_review",
      reason: undefined,
    },
    {
      op: "approve" as const,
      entityStatus: "under_review",
      eventType: "legal_entity.approved",
      next: "connect_pending",
      reason: undefined,
    },
    {
      op: "restrict" as const,
      entityStatus: "approved",
      eventType: "legal_entity.restricted",
      next: "restricted",
      reason: undefined,
    },
    {
      op: "reject" as const,
      entityStatus: "lead",
      eventType: "legal_entity.rejected",
      next: "rejected",
      reason: "Does not meet KYB documentation standards.",
    },
    {
      op: "archive" as const,
      entityStatus: "connect_pending",
      eventType: "legal_entity.archived",
      next: "archived",
      reason: "Organisation requested removal from the platform.",
    },
  ] as const;

  it.each(lifecycleCases)(
    "publishes $eventType with same tx as update for op $op",
    async ({ op, entityStatus, eventType, next, reason }) => {
      const txHandle = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: entityId, status: entityStatus }]),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      const publish = vi.fn().mockResolvedValue(undefined);
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: entityId, status: entityStatus }]),
            }),
          }),
        }),
        transaction: vi.fn(async (fn: (tx: typeof txHandle) => Promise<unknown>) => fn(txHandle)),
      };
      const publisher = { publish };

      const svc = new LegalEntityLifecycleAdminService(db as never, publisher as never);
      const result = await svc.runTransition("actor-1", entityId, op, reason);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe(next);
      }
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish.mock.calls[0]?.[0]).toBe(txHandle);
      const event = publish.mock.calls[0]?.[1] as {
        eventType: string;
        payload: Record<string, unknown>;
        actorUserId: string;
      };
      expect(event.eventType).toBe(eventType);
      expect(event.payload.from_status).toBe(entityStatus);
      expect(event.payload.to_status).toBe(next);
      expect(event.payload.reason).toBe(reason?.trim() ?? null);
      expect(event.payload).not.toHaveProperty("transition");
      expect(event.actorUserId).toBe("actor-1");
    },
  );

  it("returns 422 invalid_transition when approve is not allowed from rejected", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: entityId, status: "rejected" }]),
          }),
        }),
      }),
      transaction: vi.fn(),
    };
    const publisher = { publish: vi.fn() };

    const svc = new LegalEntityLifecycleAdminService(db as never, publisher as never);
    const result = await svc.runTransition("actor-1", entityId, "approve");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("invalid_transition");
      expect(result.error.status).toBe(422);
    }
    expect(db.transaction).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("returns 400 reason_required when reject is attempted without a reason (before transaction)", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: entityId, status: "lead" }]),
          }),
        }),
      }),
      transaction: vi.fn(),
    };
    const publisher = { publish: vi.fn() };
    const svc = new LegalEntityLifecycleAdminService(db as never, publisher as never);
    const result = await svc.runTransition("actor-1", entityId, "reject", "  ");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("reason_required");
      expect(result.error.status).toBe(400);
    }
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
