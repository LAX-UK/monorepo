import { IDENTITY_EVENT_SCHEMA_VERSION, IDENTITY_EVENT_TYPES } from "@auction/identity-contracts";
import { and, eq } from "drizzle-orm";
import { account } from "../schema/auth.js";
import { identityLifecycleOutbox } from "../schema/outbox.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

export type IdentityOutboxLifecycleEvent =
  | {
      type: "user.registered";
      userId: string;
      email: string;
      name: string;
      image?: string | null;
      phone?: string | null;
      emailVerified?: boolean;
      createdAt?: Date;
    }
  | { type: "user.email_verified"; userId: string; email: string }
  | {
      type: "user.profile_updated";
      userId: string;
      email?: string;
      emailVerified?: boolean;
      name?: string;
      phone?: string | null;
      phoneVerified?: boolean;
      image?: string | null;
      /** LAX Account's time zone choice; sent together. */
      timeZoneMode?: "automatic" | "fixed";
      timeZone?: string | null;
    }
  | { type: "user.deletion_requested"; userId: string; requestedAt?: Date }
  | { type: "user.deletion_cancelled"; userId: string; cancelledAt?: Date }
  | {
      type: "user.deletion_held";
      userId: string;
      heldAt: Date;
      reasons: readonly { code: string; message: string; href: string | null }[];
    }
  | { type: "user.identity_disabled"; userId: string; reason?: string }
  | { type: "user.identity_enabled"; userId: string }
  | { type: "user.identity_merged"; retiredSubjectId: string; canonicalSubjectId: string }
  | { type: "user.identity_deleted"; userId: string }
  | { type: "subject.data_export_requested"; userId: string; exportId: string }
  | { type: "user.session_revoked"; userId: string; sessionId?: string }
  | {
      type: "user.credential_changed";
      userId: string;
      changeType?: "create" | "update";
    }
  | { type: "user.sign_in_method_unlinked"; userId: string; provider: "google" | "apple" }
  | { type: "user.sign_in_method_added"; userId: string; method: "google" | "apple" | "passkey" }
  | { type: "user.sign_in_method_removed"; userId: string; method: "google" | "apple" | "passkey" }
  | { type: "user.unconfirmed_password_removed"; userId: string; provider: "google" | "apple" }
  | {
      type: "user.social_link_refused_staff";
      userId: string;
      provider: "google" | "apple";
      attempt: "link" | "sign_in";
    };

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
          ...(event.image !== undefined ? { image: event.image } : {}),
          ...(event.phone !== undefined ? { phone: event.phone } : {}),
          ...(event.emailVerified !== undefined ? { emailVerified: event.emailVerified } : {}),
          ...(event.createdAt ? { createdAt: event.createdAt.toISOString() } : {}),
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
          ...(event.emailVerified !== undefined ? { emailVerified: event.emailVerified } : {}),
          ...(event.name !== undefined ? { name: event.name } : {}),
          ...(event.phone !== undefined ? { phone: event.phone } : {}),
          ...(event.phoneVerified !== undefined ? { phoneVerified: event.phoneVerified } : {}),
          ...(event.image !== undefined ? { image: event.image } : {}),
          ...(event.timeZoneMode !== undefined ? { timeZoneMode: event.timeZoneMode } : {}),
          ...(event.timeZone !== undefined ? { timeZone: event.timeZone } : {}),
          updatedAt: new Date().toISOString(),
        },
      };
    case "user.deletion_requested":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.DELETION_REQUESTED,
        producer,
        actorUserId: event.userId,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          requestedAt: (event.requestedAt ?? new Date()).toISOString(),
        },
      };
    case "user.deletion_cancelled":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.DELETION_CANCELLED,
        producer,
        actorUserId: event.userId,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          cancelledAt: (event.cancelledAt ?? new Date()).toISOString(),
        },
      };
    case "user.deletion_held":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.DELETION_HELD,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          heldAt: event.heldAt.toISOString(),
          reasons: event.reasons.map((r) => ({ code: r.code, message: r.message, href: r.href })),
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
    case "subject.data_export_requested":
      return {
        aggregateType: "subject_data_export",
        aggregateId: event.exportId,
        eventType: IDENTITY_EVENT_TYPES.DATA_EXPORT_REQUESTED,
        producer,
        actorUserId: event.userId,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          exportId: event.exportId,
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
    case "user.sign_in_method_unlinked":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.SIGN_IN_METHOD_UNLINKED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          provider: event.provider,
          unlinkedAt: new Date().toISOString(),
        },
      };
    case "user.sign_in_method_added":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.SIGN_IN_METHOD_ADDED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          method: event.method,
          addedAt: new Date().toISOString(),
        },
      };
    case "user.sign_in_method_removed":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.SIGN_IN_METHOD_REMOVED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          method: event.method,
          removedAt: new Date().toISOString(),
        },
      };
    case "user.unconfirmed_password_removed":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.UNCONFIRMED_PASSWORD_REMOVED,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          provider: event.provider,
          removedAt: new Date().toISOString(),
        },
      };
    case "user.social_link_refused_staff":
      return {
        aggregateType: "user",
        aggregateId: event.userId,
        eventType: IDENTITY_EVENT_TYPES.SOCIAL_LINK_REFUSED_STAFF,
        producer,
        actorUserId: null,
        schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
        payload: {
          schemaVersion: IDENTITY_EVENT_SCHEMA_VERSION,
          subjectId: event.userId,
          provider: event.provider,
          attempt: event.attempt,
          refusedAt: new Date().toISOString(),
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
          changeType: event.changeType ?? "update",
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
