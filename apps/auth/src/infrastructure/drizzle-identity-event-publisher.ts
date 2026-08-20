import type { IdentityEventPublisher, IdentityLifecycleEvent } from "@auction/auth";
import {
  type IdentityDatabase,
  type IdentityOutboxLifecycleEvent,
  createDrizzleIdentityOutboxPublisher,
} from "@auction/identity-db";

function toOutboxEvent(event: IdentityLifecycleEvent): IdentityOutboxLifecycleEvent {
  switch (event.type) {
    case "user.registered":
    case "user.email_verified":
    case "user.profile_updated":
    case "user.deletion_requested":
    case "user.deletion_cancelled":
    case "user.identity_disabled":
    case "user.identity_enabled":
    case "user.identity_deleted":
    case "user.session_revoked":
    case "user.credential_changed":
      return event;
    case "user.identity_merged":
      return {
        type: event.type,
        retiredSubjectId: event.retiredSubjectId,
        canonicalSubjectId: event.canonicalSubjectId,
      };
  }
}

export function createDrizzleIdentityEventPublisher(
  db: IdentityDatabase,
  defaultProducer = "apps/auth",
): IdentityEventPublisher {
  const publisher = createDrizzleIdentityOutboxPublisher(db, {
    defaultProducer,
    accountDb: db,
  });
  return {
    publish(event, options) {
      return publisher.publish(toOutboxEvent(event), {
        ...(options?.producer ? { producer: options.producer } : {}),
        ...(options?.transaction ? { transaction: options.transaction as IdentityDatabase } : {}),
      });
    },
  };
}
