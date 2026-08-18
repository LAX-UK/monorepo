import { IDENTITY_EVENT_TYPES, SSF_EVENT_TYPES } from "@auction/identity-contracts";
import type { DomainEventForSsf, SsfUnsignedSignal } from "./ssf.ports.js";

export class SsfEventMapper {
  map(event: DomainEventForSsf): SsfUnsignedSignal | null {
    if (!isRecord(event.payload)) return null;
    const subjectId =
      typeof event.payload.subjectId === "string" ? event.payload.subjectId : event.aggregateId;
    const eventTimestamp = Math.floor(event.occurredAt.getTime() / 1000);
    switch (event.eventType) {
      case IDENTITY_EVENT_TYPES.SESSION_REVOKED:
        return {
          subjectId:
            typeof event.payload.sessionId === "string" ? event.payload.sessionId : subjectId,
          eventType: SSF_EVENT_TYPES.SESSION_REVOKED,
          event: { event_timestamp: eventTimestamp },
        };
      case IDENTITY_EVENT_TYPES.CREDENTIAL_CHANGED:
        return {
          subjectId,
          eventType: SSF_EVENT_TYPES.CREDENTIAL_CHANGE,
          event: {
            credential_type: "password",
            change_type: event.payload.changeType,
            event_timestamp: eventTimestamp,
          },
        };
      case IDENTITY_EVENT_TYPES.IDENTITY_DISABLED:
        return { subjectId, eventType: SSF_EVENT_TYPES.ACCOUNT_DISABLED, event: {} };
      case IDENTITY_EVENT_TYPES.IDENTITY_ENABLED:
        return { subjectId, eventType: SSF_EVENT_TYPES.ACCOUNT_ENABLED, event: {} };
      case IDENTITY_EVENT_TYPES.IDENTITY_DELETED:
        return { subjectId, eventType: SSF_EVENT_TYPES.ACCOUNT_PURGED, event: {} };
      case IDENTITY_EVENT_TYPES.IDENTITY_MERGED:
        if (typeof event.payload.retiredSubjectId !== "string") return null;
        return {
          subjectId: event.payload.retiredSubjectId,
          eventType: SSF_EVENT_TYPES.LAX_IDENTITY_MERGED,
          event: { canonical_subject_id: subjectId },
        };
      default:
        return null;
    }
  }
}

export const mapDomainEventToSsf = (event: DomainEventForSsf) => new SsfEventMapper().map(event);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
