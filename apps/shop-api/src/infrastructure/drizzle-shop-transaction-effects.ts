import type { Database } from "@auction/db";
import { domainEvent, shopAdminAudit, shopAdminCommand } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { guardDomainEventPublish } from "@auction/types";
import { and, eq } from "drizzle-orm";
import type {
  ShopAdminAuditRecord,
  ShopAdminAuditWriter,
} from "../application/ports/shop-admin-audit.writer.js";
import type {
  AdminCommandBeginInput,
  AdminCommandBeginResult,
  ShopAdminCommandWriter,
} from "../application/ports/shop-admin-command.writer.js";
import type {
  ShopDomainEventRecord,
  ShopDomainEventWriter,
} from "../application/ports/shop-domain-event.writer.js";
import type {
  ShopTransactionEffects,
  ShopUnitOfWorkFactory,
} from "../application/ports/shop-unit-of-work.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import type { ShopDomainEventPublisherMode } from "./shop-domain-event-publisher.js";

function createAuditWriter(tx: Database): ShopAdminAuditWriter {
  return {
    async append(record: ShopAdminAuditRecord) {
      await tx.insert(shopAdminAudit).values({
        actorSubjectId: record.actorSubjectId,
        capability: record.capability,
        action: record.action,
        targetType: record.targetType,
        targetId: record.targetId,
        ...(record.afterJson !== undefined ? { afterJson: JSON.stringify(record.afterJson) } : {}),
        ...(record.beforeJson !== undefined
          ? { beforeJson: JSON.stringify(record.beforeJson) }
          : {}),
        ...(record.requestId !== undefined ? { requestId: record.requestId } : {}),
      });
    },
  };
}

function createEventWriter(
  tx: Database,
  domainEventMode: ShopDomainEventPublisherMode,
): ShopDomainEventWriter {
  return {
    async append(event: ShopDomainEventRecord) {
      guardDomainEventPublish(domainEventMode, {
        eventType: event.eventType,
        payload: event.payload,
        schemaVersion: event.payload.schemaVersion,
      });
      await tx.insert(domainEvent).values({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        schemaVersion: event.payload.schemaVersion,
        producer: "shop-api",
      });
    },
  };
}

const ADMIN_COMMAND_IN_FLIGHT_LEASE_MS = 5 * 60 * 1000;

function createCommandWriter(tx: Database): ShopAdminCommandWriter {
  return {
    async begin(input: AdminCommandBeginInput): Promise<AdminCommandBeginResult> {
      const inserted = await tx
        .insert(shopAdminCommand)
        .values({
          commandType: input.commandType,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          actorSubjectId: input.actorSubjectId,
          status: "in_flight",
        })
        .onConflictDoNothing()
        .returning({ commandType: shopAdminCommand.commandType });
      if (inserted.length === 1) {
        return { kind: "started" };
      }
      const [existing] = await tx
        .select({
          requestHash: shopAdminCommand.requestHash,
          status: shopAdminCommand.status,
          resultJson: shopAdminCommand.resultJson,
          createdAt: shopAdminCommand.createdAt,
        })
        .from(shopAdminCommand)
        .where(
          and(
            eq(shopAdminCommand.commandType, input.commandType),
            eq(shopAdminCommand.actorSubjectId, input.actorSubjectId),
            eq(shopAdminCommand.idempotencyKey, input.idempotencyKey),
          ),
        )
        .for("update")
        .limit(1);
      if (!existing) {
        throw new Error("Admin command idempotency race lost");
      }
      if (existing.requestHash !== input.requestHash) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Idempotency key reused with a different payload",
          409,
        );
      }
      if (existing.status === "completed" && existing.resultJson !== null) {
        return { kind: "replay", result: existing.resultJson };
      }
      const leaseExpired =
        existing.status === "in_flight" &&
        Date.now() - existing.createdAt.getTime() > ADMIN_COMMAND_IN_FLIGHT_LEASE_MS;
      if (existing.status === "in_flight" && !leaseExpired) {
        return { kind: "conflict" };
      }
      if (leaseExpired) {
        return { kind: "conflict" };
      }
      return { kind: "started" };
    },
    async complete(input) {
      await tx
        .update(shopAdminCommand)
        .set({
          status: "completed",
          resultJson: input.result as Record<string, unknown>,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(shopAdminCommand.commandType, input.commandType),
            eq(shopAdminCommand.actorSubjectId, input.actorSubjectId),
            eq(shopAdminCommand.idempotencyKey, input.idempotencyKey),
          ),
        );
    },
  };
}

export function createShopTransactionEffects(
  tx: Database,
  domainEventMode: ShopDomainEventPublisherMode,
): ShopTransactionEffects {
  return {
    session: tx,
    audit: createAuditWriter(tx),
    events: createEventWriter(tx, domainEventMode),
    commands: createCommandWriter(tx),
    notifications: createDrizzleShopNotificationPublisher(),
  };
}

/** Unwrap the Drizzle transaction for infrastructure handlers. */
export function shopPhaseDbSession(tx: ShopTransactionEffects): Database {
  return tx.session as Database;
}

export function createDrizzleShopUnitOfWork(
  db: Database,
  domainEventMode: ShopDomainEventPublisherMode,
): ShopUnitOfWorkFactory {
  return {
    run(fn) {
      return db.transaction(async (tx) =>
        fn(createShopTransactionEffects(tx as Database, domainEventMode)),
      );
    },
  };
}
