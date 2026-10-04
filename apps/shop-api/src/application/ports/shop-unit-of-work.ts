import type { ShopAdminAuditWriter } from "./shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "./shop-admin-command.writer.js";
import type { ShopDomainEventWriter } from "./shop-domain-event.writer.js";
import type { ShopNotificationPublisher } from "./shop-notification.publisher.js";

/** Opaque transaction handle; only infrastructure may unwrap. */
export type ShopPhaseDbSession = unknown;

export type ShopTransactionEffects = {
  session: ShopPhaseDbSession;
  audit: ShopAdminAuditWriter;
  events: ShopDomainEventWriter;
  commands: ShopAdminCommandWriter;
  notifications: ShopNotificationPublisher;
};

export type ShopUnitOfWork = {
  run<T>(fn: (tx: ShopTransactionEffects) => Promise<T>): Promise<T>;
};

export type ShopUnitOfWorkFactory = ShopUnitOfWork;
