import type { Database } from "@auction/db";

export type DomainEventDeliveryStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "retryable"
  | "dead_lettered";

export type DomainEventDeliveryRow = {
  id: number;
  consumer: string;
  eventId: number;
  status: DomainEventDeliveryStatus;
  attempts: number;
  leaseExpiresAt: Date | null;
  nextRetryAt: Date | null;
  idempotencyKey: string | null;
  providerReference: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClaimDomainEventDeliveriesInput = {
  consumer: string;
  batchSize: number;
  leaseMs: number;
  now?: Date;
};

export interface IDomainEventDeliveryRepository {
  claim(input: ClaimDomainEventDeliveriesInput): Promise<DomainEventDeliveryRow[]>;
  renewLease(input: { deliveryId: number; leaseMs: number; now?: Date }): Promise<boolean>;
  markSucceeded(input: {
    deliveryId: number;
    providerReference?: string | null;
    now?: Date;
  }): Promise<void>;
  scheduleRetry(input: {
    deliveryId: number;
    nextRetryAt: Date;
    lastError: string;
    now?: Date;
  }): Promise<void>;
  deadLetter(input: { deliveryId: number; lastError: string; now?: Date }): Promise<void>;
  replay(input: { deliveryId: number; now?: Date }): Promise<void>;
  ensurePending(input: {
    consumer: string;
    eventId: number;
    idempotencyKey: string;
    now?: Date;
  }): Promise<void>;
  getById(deliveryId: number): Promise<DomainEventDeliveryRow | null>;
  listDeadLettered(input: {
    consumer?: string;
    limit: number;
    offset: number;
  }): Promise<DomainEventDeliveryRow[]>;
}

export type DomainEventDeliveryDb = Database;
