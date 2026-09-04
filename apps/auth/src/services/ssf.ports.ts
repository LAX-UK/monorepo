import type { SsfEventType } from "@auction/identity-contracts";

export type SsfStreamStatus = "enabled" | "paused" | "disabled";

export type SsfStreamRecord = {
  id: string;
  clientId: string;
  audience: string;
  endpoint: string;
  status: SsfStreamStatus;
  eventsRequested: string[];
  eventsDelivered: string[];
  lastMappedEventId: number;
  signingKid: string | null;
};

export type DomainEventForSsf = {
  id: number;
  eventType: string;
  aggregateId: string;
  payload: unknown;
  correlationId: string;
  occurredAt: Date;
};

export type SsfUnsignedSignal = {
  subjectId: string;
  eventType: SsfEventType | string;
  event: Record<string, unknown>;
};

export type SsfStreamRepository = {
  currentDomainEventId(): Promise<number>;
  provision(input: {
    id: string;
    clientId: string;
    audience: string;
    endpoint: string;
    enabled: boolean;
    events: string[];
    checkpoint: number;
    now: Date;
  }): Promise<void>;
  create(input: Omit<SsfStreamRecord, "signingKid">): Promise<SsfStreamRecord>;
  read(clientId: string, streamId?: string): Promise<SsfStreamRecord[]>;
  update(
    clientId: string,
    streamId: string,
    input: { endpoint?: string; eventsRequested?: string[]; eventsDelivered?: string[]; now: Date },
  ): Promise<SsfStreamRecord | null>;
  delete(clientId: string, streamId: string): Promise<boolean>;
  setStatus(input: {
    clientId: string;
    streamId: string;
    status: SsfStreamStatus;
    resetCheckpoint?: number;
    now: Date;
  }): Promise<boolean>;
  enabledStreams(): Promise<SsfStreamRecord[]>;
  advanceCheckpoint(streamId: string, eventId: number, now: Date): Promise<void>;
};

export type SsfSourceEventReader = {
  readUnmapped(
    streamId: string,
    afterEventId: number,
    domainEventTypes: readonly string[],
    limit: number,
  ): Promise<DomainEventForSsf[]>;
};

export type SsfDeliveryClaim = {
  id: string;
  endpoint: string;
  setToken: string;
  attemptCount: number;
};

export type SsfDeliveryRepository = {
  enqueue(input: {
    id: string;
    streamId: string;
    sourceEventId: number | null;
    eventType: string;
    jti: string;
    txn: string | null;
    signingKid: string;
    setToken: string;
    now: Date;
  }): Promise<boolean>;
  recordSigningKid(streamId: string, signingKid: string, now: Date): Promise<void>;
  claimDue(input: {
    now: Date;
    staleBefore: Date;
    batchSize: number;
  }): Promise<SsfDeliveryClaim[]>;
  finalize(input: {
    id: string;
    status: "delivered" | "pending" | "failed";
    attemptCount: number;
    nextAttemptAt: Date;
    deliveredAt: Date | null;
    statusCode: number | null;
    errorMessage: string | null;
    finalizedAt: Date;
  }): Promise<void>;
};

export type SsfSigner = {
  sign(input: {
    issuer: string;
    audience: string;
    subjectId: string;
    eventType: string;
    event: Record<string, unknown>;
    txn?: string;
    jti: string;
    issuedAt: number;
  }): Promise<{ token: string; signingKid: string }>;
};

export type SsfHttpDispatcher = {
  dispatch(endpoint: string, setToken: string, timeoutMs: number): Promise<{ status: number }>;
};
