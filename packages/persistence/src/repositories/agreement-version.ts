import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { consignmentAgreement } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
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

/** The version a writer meant to supersede is no longer current: another writer got there first. */
export class AgreementSupersededError extends Error {
  constructor(agreementId: string) {
    super(`consignment_agreement ${agreementId} is already superseded`);
    this.name = "AgreementSupersededError";
  }
}

/** A read of the current version kept finding it superseded by a writer that kept winning. */
export class CurrentAgreementUnstableError extends Error {
  constructor(submissionId: string) {
    super(`consignment_agreement for submission ${submissionId}: no stable current version`);
    this.name = "CurrentAgreementUnstableError";
  }
}

const CURRENT_READ_ATTEMPTS = 3;

/**
 * Runs a locking or updating statement on the consignment's current version and returns its rows.
 * A statement that waited on a row lock re-checks the locked row only: when the holder superseded
 * it and committed, the statement matches nothing and cannot see the successor, which the next
 * statement does. So an empty result is trusted only when the consignment has no agreement at all;
 * if one exists the statement runs again, and failing that it fails loudly instead of silently
 * doing nothing.
 */
export async function onCurrentAgreement<T>(
  db: Database | DbTransaction,
  submissionId: string,
  statement: () => Promise<T[]>,
): Promise<T | undefined> {
  for (let attempt = 0; attempt < CURRENT_READ_ATTEMPTS; attempt += 1) {
    const [row] = await statement();
    if (row !== undefined) return row;
    const [any] = await db
      .select({ id: consignmentAgreement.id })
      .from(consignmentAgreement)
      .where(eq(consignmentAgreement.submissionId, submissionId))
      .limit(1);
    if (!any) return undefined;
  }
  throw new CurrentAgreementUnstableError(submissionId);
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
  const superseded = await db
    .update(consignmentAgreement)
    .set({ supersededAt: at, supersededBy: id, updatedAt: at })
    .where(and(eq(consignmentAgreement.id, previous.id), isNull(consignmentAgreement.supersededAt)))
    .returning({ id: consignmentAgreement.id });
  if (superseded.length !== 1) throw new AgreementSupersededError(previous.id);
  await db.insert(consignmentAgreement).values(nextAgreementVersion(previous, changes, { id, at }));
  return id;
}
