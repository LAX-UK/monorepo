import {
  IDENTITY_EVENT_SCHEMA_VERSION,
  IDENTITY_EVENT_TYPES,
  type IdentityEventType,
  type UserCredentialChangedPayloadV1,
  type UserIdentityDeletedPayloadV1,
  type UserIdentityDisabledPayloadV1,
  type UserIdentityEnabledPayloadV1,
  type UserIdentityMergedPayloadV1,
  type UserProfileUpdatedPayloadV1,
  type UserSessionRevokedPayloadV1,
} from "@auction/identity-contracts";
import type { Database } from "../client.js";
import { domainEvent } from "../schema/index.js";

export type PublishIdentityLifecycleOptions = {
  producer: string;
};

export async function publishUserProfileUpdated(
  db: Database,
  input: Omit<UserProfileUpdatedPayloadV1, "schemaVersion">,
  options: PublishIdentityLifecycleOptions,
): Promise<void> {
  await appendIdentityEvent(db, {
    eventType: IDENTITY_EVENT_TYPES.PROFILE_UPDATED,
    subjectId: input.subjectId,
    payload: {
      schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
      ...input,
    },
    producer: options.producer,
  });
}

export async function publishUserIdentityDisabled(
  db: Database,
  input: Omit<UserIdentityDisabledPayloadV1, "schemaVersion">,
  options: PublishIdentityLifecycleOptions,
): Promise<void> {
  await appendIdentityEvent(db, {
    eventType: IDENTITY_EVENT_TYPES.IDENTITY_DISABLED,
    subjectId: input.subjectId,
    payload: {
      schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
      ...input,
    },
    producer: options.producer,
  });
}

export async function publishUserIdentityEnabled(
  db: Database,
  input: Omit<UserIdentityEnabledPayloadV1, "schemaVersion">,
  options: PublishIdentityLifecycleOptions,
): Promise<void> {
  await appendIdentityEvent(db, {
    eventType: IDENTITY_EVENT_TYPES.IDENTITY_ENABLED,
    subjectId: input.subjectId,
    payload: {
      schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
      ...input,
    },
    producer: options.producer,
  });
}

export async function publishUserIdentityMerged(
  db: Database,
  input: Omit<UserIdentityMergedPayloadV1, "schemaVersion">,
  options: PublishIdentityLifecycleOptions,
): Promise<void> {
  await appendIdentityEvent(db, {
    eventType: IDENTITY_EVENT_TYPES.IDENTITY_MERGED,
    subjectId: input.subjectId,
    payload: {
      schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
      ...input,
    },
    producer: options.producer,
  });
}

export async function publishUserIdentityDeleted(
  db: Database,
  input: Omit<UserIdentityDeletedPayloadV1, "schemaVersion">,
  options: PublishIdentityLifecycleOptions,
): Promise<void> {
  await appendIdentityEvent(db, {
    eventType: IDENTITY_EVENT_TYPES.IDENTITY_DELETED,
    subjectId: input.subjectId,
    payload: { schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION, ...input },
    producer: options.producer,
  });
}

export async function publishUserSessionRevoked(
  db: Database,
  input: Omit<UserSessionRevokedPayloadV1, "schemaVersion">,
  options: PublishIdentityLifecycleOptions,
): Promise<void> {
  await appendIdentityEvent(db, {
    eventType: IDENTITY_EVENT_TYPES.SESSION_REVOKED,
    subjectId: input.subjectId,
    payload: { schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION, ...input },
    producer: options.producer,
  });
}

export async function publishUserCredentialChanged(
  db: Database,
  input: Omit<UserCredentialChangedPayloadV1, "schemaVersion">,
  options: PublishIdentityLifecycleOptions,
): Promise<void> {
  await appendIdentityEvent(db, {
    eventType: IDENTITY_EVENT_TYPES.CREDENTIAL_CHANGED,
    subjectId: input.subjectId,
    payload: { schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION, ...input },
    producer: options.producer,
  });
}

async function appendIdentityEvent(
  db: Database,
  input: {
    eventType: IdentityEventType;
    subjectId: string;
    payload: Record<string, unknown>;
    producer: string;
  },
): Promise<void> {
  await db.insert(domainEvent).values({
    aggregateType: "user",
    aggregateId: input.subjectId,
    eventType: input.eventType,
    producer: input.producer,
    payload: input.payload,
    actorUserId: null,
    schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
  });
}
