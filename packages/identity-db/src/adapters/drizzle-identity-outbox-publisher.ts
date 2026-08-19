import { IDENTITY_EVENT_SCHEMA_VERSION, IDENTITY_EVENT_TYPES } from "@auction/identity-contracts";
import { and, eq } from "drizzle-orm";
import { account } from "../schema/auth.js";
import { identityLifecycleOutbox } from "../schema/outbox.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

export type IdentityOutboxLifecycleEvent =
  | { type: "user.registered"; userId: string; email: string; name: string }
  | { type: "user.email_verified"; userId: string; email: string }
  | {
      type: "user.profile_updated";
      userId: string;
      email?: string;
      name?: string;
      phone?: string | null;
    }
  | { type: "user.identity_disabled"; userId: string; reason?: string }
  | { type: "user.identity_enabled"; userId: string }
  | { type: "user.identity_merged"; retiredSubjectId: string; canonicalSubjectId: string }
  | { type: "user.identity_deleted"; userId: string }
  | { type: "user.session_revoked"; userId: string; sessionId?: string }
  | { type: "user.credential_changed"; userId: string };

export type IdentityOutboxPublisher = {
  publish(
    event: IdentityOutboxLifecycleEvent,
    options?: { producer?: string; transaction?: IdentityDatabase },
  ): Promise<void>;
};

type UserRegisteredSource = "credential" | "google" | "apple";

async function resolveRegistrationSource(
  db: IdentityDatabase,
  userId: string,
): Promise<UserRegisteredSource> {
  const [row] = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId))
    .limit(1);
  if (!row) return "credential";
  const provider = row.providerId.toLowerCase();
  if (provider === "google") return "google";
  if (provider === "apple") return "apple";
  return "credential";
}

function buildOutboxRow(
  event: IdentityOutboxLifecycleEvent,
  producer: string,
  source?: UserRegisteredSource,
): {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  producer: string;
  actorUserId: string | null;
  schemaVersion: number;
} {
  switch (event.type) {
    case "user.registered":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: event.type,
        producer,
        actorUserId: null,
        schemaVersion: 1,
        payload: {
          userId: event.userId,
          email: event.email,
          name: event.name,
          source: source ?? "credential",
        },
      };
    case "user.email_verified":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: event.type,
        producer,
        actorUserId: event.userId,
        schemaVersion: 1,
        payload: {
          userId: event.userId,
          email: event.email,
          verifiedAt: new Date().toISOString(),
        },
      };
    case "user.profile_updated":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.PROFILE_UPDATED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          ...(event.email !== undefined ? { email: event.email } : {}),
          ...(event.name !== undefined ? { name: event.name } : {}),
          ...(event.phone !== undefined ? { phone: event.phone } : {}),
          updatedAt: new Date().toISOString(),
        },
      };
    case "user.identity_disabled":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.IDENTITY_DISABLED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          disabledAt: new Date().toISOString(),
          ...(event.reason ? { reason: event.reason } : {}),
        },
      };
    case "user.identity_enabled":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.IDENTITY_ENABLED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          enabledAt: new Date().toISOString(),
        },
      };
    case "user.identity_merged":
      return {
        aggregateType: "user",
        aggregateId: event.canonicalSubjectId,
        eventType: IDENTITY_EVENT_TYPES.IDENTITY_MERGED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.canonicalSubjectId,
          retiredSubjectId: event.retiredSubjectId,
          mergedAt: new Date().toISOString(),
        },
      };
    case "user.identity_deleted":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.IDENTITY_DELETED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          deletedAt: new Date().toISOString(),
        },
      };
    case "user.session_revoked":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.SESSION_REVOKED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          ...(event.sessionId ? { sessionId: event.sessionId } : {}),
          revokedAt: new Date().toISOString(),
        },
      };
    case "user.credential_changed":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.CREDENTIAL_CHANGED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          credentialType: "password",
          changeType: "update",
          changedAt: new Date().toISOString(),
        },
      };
  }
}

const IDEMPOTENT_EVENT_TYPES = new Set(["user.registered", "user.email_verified"]);

export function createDrizzleIdentityOutboxPublisher(
  db: IdentityDatabase,
  options?: { defaultProducer?: string; accountDb?: IdentityDatabase },
): IdentityOutboxPublisher {
  const defaultProducer = options?.defaultProducer ?? "apps/auth";
  const accountDb = options?.accountDb ?? db;

  return {
    async publish(event, publishOptions) {
      const producer = publishOptions?.producer ?? defaultProducer;
      const writeDb = publishOptions?.transaction ?? db;
      const source =
        event.type === "user.registered"
          ? await resolveRegistrationSource(publishOptions?.transaction ?? accountDb, event.userId)
          : undefined;
      const row = buildOutboxRow(event, producer, source);

      if (IDEMPOTENT_EVENT_TYPES.has(event.type)) {
        const [existing] = await writeDb
          .select({ id: identityLifecycleOutbox.id })
          .from(identityLifecycleOutbox)
          .where(
            and(
              eq(identityLifecycleOutbox.aggregateType, row.aggregateType),
              eq(identityLifecycleOutbox.aggregateId, row.aggregateId),
              eq(identityLifecycleOutbox.eventType, row.eventType),
            ),
          )
          .limit(1);
        if (existing) return;
      }

      await writeDb.insert(identityLifecycleOutbox).values(row).onConflictDoNothing();
    },
  };
}
