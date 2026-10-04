import type { LiveDomainEventType } from "@auction/types";

export type ShopDomainEventRecord = {
  aggregateType: string;
  aggregateId: string;
  eventType: LiveDomainEventType;
  payload: Record<string, unknown> & { schemaVersion: 1 };
};

export type ShopDomainEventWriter = {
  append(event: ShopDomainEventRecord): Promise<void>;
};
