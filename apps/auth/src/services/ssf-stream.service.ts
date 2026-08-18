import {
  FIRST_PARTY_SSF_EVENT_TYPES,
  SSF_RECEIVER_REGISTRY,
  SSF_VERIFICATION_EVENT,
  type SsfEventType,
  type SsfReceiverClientId,
  isAllowedSsfEndpoint,
} from "@auction/identity-contracts";
import type {
  SsfDeliveryRepository,
  SsfSigner,
  SsfStreamRepository,
  SsfStreamStatus,
} from "./ssf.ports.js";

export type SsfStreamConfiguration = {
  stream_id: string;
  iss: string;
  aud: string;
  delivery: { method: "urn:ietf:rfc:8935"; endpoint_url: string };
  events_supported: readonly SsfEventType[];
  events_requested: string[];
  events_delivered: string[];
  status: SsfStreamStatus;
};

export class SsfStreamService {
  constructor(
    private readonly streams: SsfStreamRepository,
    private readonly deliveries: SsfDeliveryRepository,
    private readonly signer: SsfSigner,
    private readonly issuer: string,
    private readonly environment: "development" | "test" | "production",
    private readonly now: () => Date = () => new Date(),
  ) {}

  async provisionRegisteredStreams(enabled: boolean): Promise<void> {
    const checkpoint = await this.streams.currentDomainEventId();
    for (const [clientId, receiver] of Object.entries(SSF_RECEIVER_REGISTRY)) {
      await this.streams.provision({
        id: `ssf-${clientId}`,
        clientId,
        audience: receiver.audience,
        endpoint:
          this.environment === "development" ? receiver.developmentEndpoints[0] : receiver.endpoint,
        enabled,
        events: [...FIRST_PARTY_SSF_EVENT_TYPES],
        checkpoint,
        now: this.now(),
      });
    }
  }

  async create(
    clientId: SsfReceiverClientId,
    input: { endpoint: string; eventsRequested: string[] },
  ): Promise<SsfStreamConfiguration> {
    this.validateEndpoint(clientId, input.endpoint);
    const eventsDelivered = supported(input.eventsRequested);
    const row = await this.streams.create({
      id: crypto.randomUUID(),
      clientId,
      audience: SSF_RECEIVER_REGISTRY[clientId].audience,
      endpoint: input.endpoint,
      status: "disabled",
      eventsRequested: input.eventsRequested,
      eventsDelivered,
      lastMappedEventId: await this.streams.currentDomainEventId(),
    });
    return this.toConfiguration(row);
  }

  async read(clientId: string, streamId?: string): Promise<SsfStreamConfiguration[]> {
    return (await this.streams.read(clientId, streamId)).map((row) => this.toConfiguration(row));
  }

  async update(
    clientId: SsfReceiverClientId,
    streamId: string,
    input: { endpoint?: string; eventsRequested?: string[] },
  ): Promise<SsfStreamConfiguration | null> {
    if (input.endpoint !== undefined) this.validateEndpoint(clientId, input.endpoint);
    const eventsDelivered = input.eventsRequested ? supported(input.eventsRequested) : undefined;
    const row = await this.streams.update(clientId, streamId, {
      ...input,
      ...(eventsDelivered ? { eventsDelivered } : {}),
      now: this.now(),
    });
    return row ? this.toConfiguration(row) : null;
  }

  delete(clientId: string, streamId: string): Promise<boolean> {
    return this.streams.delete(clientId, streamId);
  }

  async setStatus(clientId: string, streamId: string, status: SsfStreamStatus): Promise<boolean> {
    const existing = (await this.streams.read(clientId, streamId))[0];
    if (!existing) return false;
    const resetCheckpoint =
      status === "enabled" && existing.status === "disabled"
        ? await this.streams.currentDomainEventId()
        : undefined;
    return this.streams.setStatus({
      clientId,
      streamId,
      status,
      ...(resetCheckpoint === undefined ? {} : { resetCheckpoint }),
      now: this.now(),
    });
  }

  async enqueueVerification(clientId: string, streamId: string, state?: string): Promise<boolean> {
    const stream = (await this.streams.read(clientId, streamId))[0];
    if (!stream) return false;
    const jti = crypto.randomUUID();
    const now = this.now();
    const signed = await this.signer.sign({
      issuer: this.issuer,
      audience: stream.audience,
      subjectId: stream.id,
      eventType: SSF_VERIFICATION_EVENT,
      event: state ? { state } : {},
      jti,
      issuedAt: Math.floor(now.getTime() / 1_000),
    });
    const inserted = await this.deliveries.enqueue({
      id: crypto.randomUUID(),
      streamId: stream.id,
      sourceEventId: null,
      eventType: SSF_VERIFICATION_EVENT,
      jti,
      txn: null,
      signingKid: signed.signingKid,
      setToken: signed.token,
      now,
    });
    if (inserted && stream.signingKid !== signed.signingKid) {
      await this.deliveries.recordSigningKid(stream.id, signed.signingKid, now);
    }
    return true;
  }

  private validateEndpoint(clientId: SsfReceiverClientId, endpoint: string): void {
    if (!isAllowedSsfEndpoint(clientId, endpoint, this.environment)) {
      throw new Error("invalid_endpoint");
    }
  }

  private toConfiguration(row: Awaited<ReturnType<SsfStreamRepository["read"]>>[number]) {
    return {
      stream_id: row.id,
      iss: this.issuer,
      aud: row.audience,
      delivery: { method: "urn:ietf:rfc:8935" as const, endpoint_url: row.endpoint },
      events_supported: FIRST_PARTY_SSF_EVENT_TYPES,
      events_requested: row.eventsRequested,
      events_delivered: row.eventsDelivered,
      status: row.status,
    };
  }
}

function supported(requested: string[]): SsfEventType[] {
  const events = requested.filter((event): event is SsfEventType =>
    FIRST_PARTY_SSF_EVENT_TYPES.includes(event as SsfEventType),
  );
  if (events.length === 0) throw new Error("unsupported_events");
  return events;
}
