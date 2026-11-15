import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { describe, expect, it } from "vitest";
import { eraseCollectionBookings } from "../anonymisation/collection-booking-erasure.js";
import type { DomainEventProjectorRow } from "../interfaces/domain-event-projector.reader.js";
import { listCatalogueImageKeys } from "../lib/catalogue-image-keys.js";
import { applyBidIdentityDirectoryEvent } from "../projectors/bid-identity-directory.js";
import type { WorkerDb } from "../workers/types.js";
import { today } from "./worker-role-contract.fixtures.js";
import { NIL, runRolledBack } from "./worker-role-contract.test-helpers.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Worker code that queries the database itself instead of through a repository class, so neither
 * role-contract suite reaches it: the Bid identity directory projector, the collection booking
 * erasure and the catalogue image key listing. Each runs as `worker_app` on a transaction that is
 * rolled back (see worker-role-contract.integration.test.ts for why only a denial can fail a call).
 * The other inline users of the worker database are covered where they live: the domain event
 * insert of the personal-data anonymisation by `domainEventSink`, the rest of its erasure by
 * bid-anonymisation-role-contract.integration.test.ts and the Zoho fulfilment and CRM readers by
 * their own integration tests.
 */

const SUBJECT = "00000000-0000-0000-0000-0000000000b1";
const RETIRED = "00000000-0000-0000-0000-0000000000b2";
const stamp = today.toISOString();

function event(
  id: number,
  eventType: string,
  payload: Record<string, unknown>,
): DomainEventProjectorRow {
  return { id, eventType, aggregateId: SUBJECT, payload, occurredAt: today };
}

const registered = (id: number, userId: string) =>
  event(id, "user.registered", {
    userId,
    email: `${userId}@role-contract.test`,
    name: "Role contract",
    source: "credential",
  });

/** The directory events by type, each with the events that must come first for it to find a row. */
const DIRECTORY_EVENTS: Record<string, DomainEventProjectorRow[]> = {
  "user.registered": [registered(1, SUBJECT)],
  "user.profile_updated": [
    registered(1, SUBJECT),
    event(2, "user.profile_updated", {
      schemaVersion: 1,
      subjectId: SUBJECT,
      name: "Renamed",
      email: "renamed@role-contract.test",
      phone: null,
      image: null,
      timeZoneMode: "fixed",
      timeZone: "Europe/London",
      updatedAt: stamp,
    }),
  ],
  "user.email_verified": [
    registered(1, SUBJECT),
    event(2, "user.email_verified", {
      userId: SUBJECT,
      email: "verified@role-contract.test",
      verifiedAt: stamp,
    }),
  ],
  "user.deletion_requested": [
    registered(1, SUBJECT),
    event(2, "user.deletion_requested", {
      schemaVersion: 1,
      subjectId: SUBJECT,
      requestedAt: stamp,
    }),
  ],
  "user.deletion_cancelled": [
    registered(1, SUBJECT),
    event(2, "user.deletion_cancelled", {
      schemaVersion: 1,
      subjectId: SUBJECT,
      cancelledAt: stamp,
    }),
  ],
  "user.deletion_held": [
    registered(1, SUBJECT),
    event(2, "user.deletion_held", {
      schemaVersion: 1,
      subjectId: SUBJECT,
      heldAt: stamp,
      reasons: [{ code: "role_contract", message: "Role contract", href: null }],
    }),
  ],
  // A merge needs both subjects in the directory to reach the statement that folds one into the other.
  "user.identity_merged": [
    registered(1, SUBJECT),
    registered(2, RETIRED),
    event(3, "user.identity_merged", {
      schemaVersion: 1,
      subjectId: SUBJECT,
      retiredSubjectId: RETIRED,
      mergedAt: stamp,
    }),
  ],
  "user.identity_deleted": [
    registered(1, SUBJECT),
    event(2, "user.identity_deleted", {
      schemaVersion: 1,
      subjectId: SUBJECT,
      deletedAt: stamp,
    }),
  ],
};

describe.skipIf(!ownerUrl || !workerUrl)("inline worker queries as worker_app", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
  const db = createDb(workerUrl!) as unknown as WorkerDb;

  it("applies the role grants", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    await applyApplicationRoleGrants(ownerUrl!);
  });

  it("probes every event type the Bid identity directory follows", async () => {
    const { BID_IDENTITY_DIRECTORY_EVENT_TYPES } = await import(
      "../projectors/bid-identity-directory.js"
    );
    expect(Object.keys(DIRECTORY_EVENTS).sort()).toEqual(
      [...BID_IDENTITY_DIRECTORY_EVENT_TYPES].sort(),
    );
  });

  it.each(Object.entries(DIRECTORY_EVENTS))(
    "bid identity directory applies %s",
    async (_type, events) => {
      const outcome = await runRolledBack(db, async (tx) => {
        for (const row of events) await applyBidIdentityDirectoryEvent(tx, row, today);
      });
      if (outcome.denied) throw new Error(outcome.denied);
      expect(outcome.failure, "the call must complete, not stop before PostgreSQL").toBeNull();
    },
  );

  it("collection booking erasure", async () => {
    const outcome = await runRolledBack(db, (tx) =>
      eraseCollectionBookings(
        tx,
        { subjectIds: [SUBJECT], personalLegalEntityIds: [NIL], pseudonym: "Role contract" },
        today,
      ),
    );
    if (outcome.denied) throw new Error(outcome.denied);
    expect(outcome.failure).toBeNull();
  });

  it.each([true, false])("catalogue image keys (force %s)", async (force) => {
    const outcome = await runRolledBack(db, (tx) => listCatalogueImageKeys(tx as never, { force }));
    if (outcome.denied) throw new Error(outcome.denied);
    expect(outcome.failure).toBeNull();
  });
});
