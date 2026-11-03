import type { IdentityDatabase } from "@auction/identity-db";
import { identityLifecycleOutbox, user } from "@auction/identity-db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "../../../subject-export/sourced-export-category.js";
import { iso } from "../../../subject-export/values.js";

type ContactRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
};

/** An address and the moment Identity recorded it, from the lifecycle events. */
export type EmailEvent = { eventType: string; email: string | null; occurredAt: Date };

/**
 * The addresses held before the current one, each with the date it was replaced. The first
 * address comes from the registration event and later ones from profile updates that carried an
 * email, so the history is as complete as the lifecycle events that are still kept.
 */
export function previousEmails(events: readonly EmailEvent[], currentEmail: string) {
  const sequence = events
    .filter(
      (event) =>
        (event.eventType === "user.registered" || event.eventType === "user.profile_updated") &&
        event.email,
    )
    .map((event) => ({ email: (event.email as string).toLowerCase(), at: event.occurredAt }));
  const current = currentEmail.toLowerCase();
  const history: { email: string; changedAt: string | null }[] = [];
  for (let i = 0; i < sequence.length; i += 1) {
    const entry = sequence[i] as { email: string; at: Date };
    const next = sequence[i + 1];
    if (next ? next.email === entry.email : entry.email === current) continue;
    history.push({ email: entry.email, changedAt: iso(next ? next.at : null) });
  }
  return history;
}

export function mapContact(row: ContactRow, events: readonly EmailEvent[]) {
  const verified = events.find(
    (event) => event.eventType === "user.email_verified" && event.email === row.email,
  );
  return {
    id: row.id,
    origin: "provided" as const,
    email: row.email,
    emailVerified: row.emailVerified,
    emailVerifiedAt: row.emailVerified ? iso(verified?.occurredAt) : null,
    previousEmails: previousEmails(events, row.email),
    phone: row.phoneNumber,
    phoneVerified: row.phoneNumber ? row.phoneNumberVerified : false,
    // Only whether the phone is confirmed is stored, not when.
    phoneVerifiedAt: null,
  };
}

const EMAIL_EVENT_TYPES = ["user.registered", "user.profile_updated", "user.email_verified"];

/**
 * Current email and phone, plus the email history the lifecycle events keep. Only the email field
 * of each event is read, never the rest of its payload.
 */
export class ContactExportCategory extends SourcedExportCategory {
  readonly id = "contact";
  protected readonly sources: readonly ExportSource[];

  constructor(db: IdentityDatabase) {
    super();
    this.sources = [
      inMemorySource(async (subjectId) => {
        const [row] = await db
          .select({
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            phoneNumber: user.phoneNumber,
            phoneNumberVerified: user.phoneNumberVerified,
          })
          .from(user)
          .where(eq(user.id, subjectId))
          .limit(1);
        if (!row) return [];
        const events = await db
          .select({
            eventType: identityLifecycleOutbox.eventType,
            email: sql<string | null>`lower(${identityLifecycleOutbox.payload}->>'email')`,
            occurredAt: identityLifecycleOutbox.occurredAt,
          })
          .from(identityLifecycleOutbox)
          .where(
            and(
              eq(identityLifecycleOutbox.aggregateType, "user"),
              eq(identityLifecycleOutbox.aggregateId, subjectId),
              inArray(identityLifecycleOutbox.eventType, EMAIL_EVENT_TYPES),
            ),
          )
          .orderBy(asc(identityLifecycleOutbox.occurredAt), asc(identityLifecycleOutbox.id));
        return [{ key: row.id, record: mapContact(row, events) }];
      }),
    ];
  }
}
