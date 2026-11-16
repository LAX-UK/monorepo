import { drizzle } from "drizzle-orm/node-postgres";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "../../../migrate-runner.js";
import * as schema from "../../../schema/index.js";
import { withTemporaryDatabase } from "../../../testing/temporary-database.js";
import { runLegacyDemoSeed } from "../../dev/legacy-demo-seed.js";
import { runDemoFull } from "../demo-full-seed.js";
import { QUEUE_SEEDERS } from "./index.js";
import { QUEUE_IDS } from "./queue-ids.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const NOW = Date.UTC(2026, 10, 16, 9, 0);

async function legacySeed(databaseUrl: string) {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  try {
    await runLegacyDemoSeed();
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, "DATABASE_URL");
    else process.env.DATABASE_URL = previous;
  }
}

async function one(pool: pg.Pool, text: string, values: unknown[] = []) {
  return (await pool.query(text, values)).rows[0];
}

/** Each queue as its staff screen reads it (the filters of the real readers), by the seeded id. */
const QUEUE_CHECKS: { queue: string; sql: string; id: string }[] = [
  {
    queue: "purchase problems: open",
    sql: `select p.id from purchase_problem p join lot l on l.id = p.lot_id
          join legal_entity e on e.id = p.buyer_legal_entity_id join payment pay on pay.id = p.payment_id
          where p.status = 'open'`,
    id: QUEUE_IDS.purchaseProblem(1),
  },
  {
    queue: "work inbox: unapplied money",
    sql: `select d.payload->>'dedupeKey' as id from domain_events d
          where d.event_type = 'payment.unapplied_money_received'
            and not exists (select 1 from domain_events r where r.event_type = 'payment.unapplied_money_resolved'
                            and r.payload->>'dedupeKey' = d.payload->>'dedupeKey')
            and d.payload->>'reason' <> 'invoice_cancelled'`,
    id: "customer_balance_unapplied:evt_demo_example_unapplied_0001:gbp",
  },
  {
    queue: "disputes: needs allocation",
    sql: `select id from dispute_case where allocation_state = 'needs_allocation'
          and status not in ('won', 'warning_closed', 'prevented')`,
    id: QUEUE_IDS.disputeCase(1),
  },
  {
    queue: "data requests: open",
    sql: `select e.id from subject_data_export e where e.status in ('requested', 'collecting', 'delayed', 'failed')
          and not exists (select 1 from subject_data_request r where r.linked_export_id = e.id)`,
    id: QUEUE_IDS.dataExport(1),
  },
  {
    queue: "collection desk: upcoming",
    sql: `select id from collection_booking where status = 'booked' and slot_start > $1`,
    id: QUEUE_IDS.booking(1),
  },
  {
    queue: "lot fulfilment: awaiting release",
    sql: `select lot_id as id from lot_fulfilment
          where status in ('awaiting_release', 'released', 'ready_for_collection', 'in_transit')`,
    id: QUEUE_IDS.lot(2),
  },
  {
    queue: "submissions: awaiting review",
    sql: `select id from item_submission where status in ('submitted', 'under_review')`,
    id: QUEUE_IDS.submission(1),
  },
  {
    queue: "private sales: active",
    sql: `select d.id from private_sale_deal d join item_submission s on s.id = d.item_submission_id
          join private_sale_deal_party p on p.deal_id = d.id and p.role = 'seller'
          where d.stage in ('proposed', 'offer', 'agreed', 'cleared', 'invoiced', 'paid', 'released')`,
    id: QUEUE_IDS.privateSaleDeal(1),
  },
];

/** What staff might have done to each seeded item between two runs of the seed. */
const STAFF_WORK = [
  `update collection_booking set status = 'cancelled', cancelled_at = now(), cancelled_by_user_id = null
     where id = '${QUEUE_IDS.booking(1)}'`,
  `update collection_booking_lot set active = false where booking_id = '${QUEUE_IDS.booking(1)}'`,
  `update lot_fulfilment set status = 'delivered', collected_at = now(), collected_by = 'Front desk'
     where lot_id = '${QUEUE_IDS.lot(1)}'`,
  `update lot_fulfilment set status = 'released', release_approved_at = now() where lot_id = '${QUEUE_IDS.lot(2)}'`,
  `update dispute_case set status = 'won', closed_at = now(), version = version + 1 where id = '${QUEUE_IDS.disputeCase(1)}'`,
  `update purchase_problem set status = 'resolved', resolved_at = now() where id = '${QUEUE_IDS.purchaseProblem(1)}'`,
  `update subject_data_export set status = 'failed', last_error_code = 'staff_checked' where id = '${QUEUE_IDS.dataExport(1)}'`,
  `update item_submission set status = 'under_review' where id = '${QUEUE_IDS.submission(1)}'`,
  `update private_sale_deal set stage = 'cancelled', cancel_reason = 'buyer_withdrew', cancelled_at = now(), version = version + 1 where id = '${QUEUE_IDS.privateSaleDeal(1)}'`,
  `update venue set name = 'Renamed by staff' where id = '${QUEUE_IDS.venue(1)}'`,
  `delete from collection_weekly_hours where venue_id = '${QUEUE_IDS.venue(1)}' and weekday = 5`,
  `update sale set venue_id = null, location_name = null where id = '${QUEUE_IDS.sale(1)}'`,
];

/** Every row the seeders own, as JSON, and the counts of the tables they add to. */
async function snapshot(pool: pg.Pool) {
  const rows = await one(
    pool,
    `select json_build_object(
       'booking', (select row_to_json(b) from collection_booking b where id = $1),
       'bookingLots', (select json_agg(row_to_json(l) order by lot_id) from collection_booking_lot l where booking_id = $1),
       'fulfilment', (select json_agg(row_to_json(f) order by lot_id) from lot_fulfilment f where lot_id in ($2, $3, $4)),
       'dispute', (select row_to_json(d) from dispute_case d where id = $5),
       'problem', (select row_to_json(p) from purchase_problem p where id = $6),
       'export', (select row_to_json(e) from subject_data_export e where id = $7),
       'submission', (select row_to_json(s) from item_submission s where id = $8),
       'deal', (select row_to_json(d) from private_sale_deal d where id = $9),
       'venue', (select row_to_json(v) from venue v where id = $10),
       'sale', (select row_to_json(s) from sale s where id = $11),
       'hours', (select count(*) from collection_weekly_hours where venue_id = $10)
     ) as rows`,
    [
      QUEUE_IDS.booking(1),
      QUEUE_IDS.lot(1),
      QUEUE_IDS.lot(2),
      QUEUE_IDS.lot(3),
      QUEUE_IDS.disputeCase(1),
      QUEUE_IDS.purchaseProblem(1),
      QUEUE_IDS.dataExport(1),
      QUEUE_IDS.submission(1),
      QUEUE_IDS.privateSaleDeal(1),
      QUEUE_IDS.venue(1),
      QUEUE_IDS.sale(1),
    ],
  );
  const counts = await one(
    pool,
    `select (select count(*) from domain_events) as events,
            (select count(*) from collection_booking) as bookings,
            (select count(*) from dispute_case_candidate) as candidates,
            (select count(*) from subject_data_export_audit) as export_audit,
            (select count(*) from private_sale_deal_stage_history) as stage_history,
            (select count(*) from private_sale_deal_party_history) as party_history,
            (select count(*) from purchase_problem) as problems,
            (select count(*) from item_submission) as submissions,
            (select count(*) from lot_fulfilment) as fulfilments`,
  );
  return { rows: rows?.rows, counts };
}

describe.skipIf(!url)("demo seed: an item in the staff queues", { timeout: 600_000 }, () => {
  it("fills each queue the way its screen reads it, and never undoes staff work", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransaction(pool);
      await legacySeed(databaseUrl);
      await pool.query(
        `insert into demo_seed_target (environment, database_name, marked_by)
         values ('local', current_database(), 'integration test')`,
      );
      const db = drizzle(pool, { schema });
      const first = await runDemoFull(db, NOW);
      expect(first.queues).toEqual(QUEUE_SEEDERS.map((s) => s.queue));

      for (const check of QUEUE_CHECKS) {
        const found = (await pool.query(check.sql, check.sql.includes("$1") ? [new Date(NOW)] : []))
          .rows;
        expect(
          found.map((r) => r.id),
          check.queue,
        ).toContain(check.id);
      }

      // Events and history the real services write, with the demo seed's producer.
      const events = (
        await pool.query(
          `select event_type, producer from domain_events where producer = 'demo-seed' order by event_type`,
        )
      ).rows.map((r) => r.event_type);
      expect(events).toEqual([
        "collection.booking.created",
        "dispute_case.needs_allocation",
        "marketing_enquiry.converted",
        "payment.unapplied_money_received",
        "private_sale_deal.created",
        "private_sale_deal.party_named",
        "private_sale_deal.stage_changed",
        "private_sale_deal.terms_changed",
        "purchase_problem.reported",
      ]);
      const candidates = await one(
        pool,
        "select count(*)::int as n from dispute_case_candidate where case_id = $1",
        [QUEUE_IDS.disputeCase(1)],
      );
      expect(candidates?.n).toBe(2);
      const alerts = await one(
        pool,
        `select deadline_alert_tier as tier, (select count(*)::int from subject_data_export_audit a where a.export_id = e.id) as audit
           from subject_data_export e where id = $1`,
        [QUEUE_IDS.dataExport(1)],
      );
      // Every deadline alert already raised, so the deadline job raises none on test.
      expect(alerts).toEqual({ tier: 3, audit: 5 });
      const booked = await one(
        pool,
        `select b.slot_start, h.opens_local from collection_booking b
           join collection_weekly_hours h on h.venue_id = b.venue_id
                and h.weekday = extract(isodow from b.slot_start at time zone 'Europe/London')
          where b.id = $1`,
        [QUEUE_IDS.booking(1)],
      );
      expect(booked?.opens_local).toBe("10:00");

      // A second run with nothing changed writes nothing.
      const untouched = await snapshot(pool);
      await runDemoFull(db, NOW + 60_000);
      expect(await snapshot(pool)).toEqual(untouched);

      // Staff work every item; a later run (days on, as on test) leaves all of it as it is.
      for (const statement of STAFF_WORK) await pool.query(statement);
      const worked = await snapshot(pool);
      await runDemoFull(db, NOW + 4 * 86_400_000);
      expect(await snapshot(pool)).toEqual(worked);
    });
  });

  it("refuses a database without the demo seed mark and writes nothing", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const db = drizzle(pool, { schema });
      const before = await one(pool, "select count(*)::int as n from venue");
      await expect(runDemoFull(db, NOW)).rejects.toThrow(/not marked as a demo seed target/);
      expect(await one(pool, "select count(*)::int as n from venue")).toEqual(before);

      // A mark copied from another database (a restored dump) is refused too.
      await pool.query(
        `insert into demo_seed_target (environment, database_name, marked_by)
         values ('test', 'some_other_database', 'restored copy')`,
      );
      await expect(runDemoFull(db, NOW)).rejects.toThrow(/restored copy/);
    });
  });
});
