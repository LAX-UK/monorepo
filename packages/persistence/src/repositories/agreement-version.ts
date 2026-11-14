import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { consignmentAgreement } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";

type AgreementRow = typeof consignmentAgreement.$inferSelect;
type AgreementInsert = typeof consignmentAgreement.$inferInsert;

/** What an edit changes on the next version; its identity and place in the history are not. */
export type AgreementVersionChanges = Omit<
  Partial<AgreementInsert>,
  "id" | "submissionId" | "version" | "supersededAt" | "supersededBy" | "createdAt" | "updatedAt"
>;

/**
 * The next version of a signed agreement: the previous version's terms with the edit applied,
 * numbered one up and current. Reminders belong to the proposal they chased, so they start over.
 */
export function nextAgreementVersion(
  previous: AgreementRow,
  changes: AgreementVersionChanges,
  next: { id: string; at: Date },
): AgreementInsert {
  const {
    id: _id,
    createdAt: _createdAt,
    supersededAt: _supersededAt,
    supersededBy: _supersededBy,
    reminderDay3SentAt: _day3,
    reminderDay7SentAt: _day7,
    ...terms
  } = previous;
  return {
    ...terms,
    ...changes,
    id: next.id,
    version: previous.version + 1,
    supersededAt: null,
    supersededBy: null,
    createdAt: next.at,
    updatedAt: next.at,
  };
}

/**
 * Edits a signed agreement by adding its next version and marking `previous` superseded by it, so
 * whatever was priced on `previous` keeps pointing at exactly what was signed. Runs inside the
 * caller's transaction: the superseded row names its successor before the successor exists (the
 * foreign key is checked at commit), and only then can the successor take the current place.
 * Returns the new version's id.
 */
export async function supersedeAgreement(
  db: Database | DbTransaction,
  previous: AgreementRow,
  changes: AgreementVersionChanges,
  at: Date,
): Promise<string> {
  const id = randomUUID();
  await db
    .update(consignmentAgreement)
    .set({ supersededAt: at, supersededBy: id, updatedAt: at })
    .where(eq(consignmentAgreement.id, previous.id));
  await db.insert(consignmentAgreement).values(nextAgreementVersion(previous, changes, { id, at }));
  return id;
}
