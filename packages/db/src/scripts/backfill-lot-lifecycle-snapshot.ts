/**
 * Idempotent backfill for lot_lifecycle_snapshot from lot rows + domain_events.
 *
 * Usage from packages/db:
 *   DATABASE_URL=... pnpm db:backfill-lot-lifecycle-snapshot
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../ssl.js";

const { Pool } = pg;

type LotSnapshotSource = {
  lot_id: string;
  current_status: string;
  winner_id: string | null;
  sale_id: string | null;
  updated_at: Date;
  last_event_type: string | null;
  last_event_at: Date | null;
  last_actor_user_id: string | null;
  return_count: number;
  last_returned_at: Date | null;
  last_return_sale_id: string | null;
  attached_count: number | null;
  event_last_sale_id: string | null;
  ended_outcome: string | null;
  ended_at: Date | null;
};

function inferOutcome(status: string, winnerId: string | null): string | null {
  if (status === "cancelled") return "cancelled";
  if (status === "ended") return winnerId ? "sold" : "no_sale";
  if (status === "voided") return "no_sale";
  return null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL");
    process.exit(1);
  }
  const pool = new Pool(buildPgConnectionConfig(url));

  const { rows } = await pool.query<LotSnapshotSource>(`
    select
      l.id as lot_id,
      l.status as current_status,
      l.winner_id,
      l.sale_id,
      l.updated_at,
      ev.last_event_type,
      ev.last_event_at,
      ev.last_actor_user_id,
      coalesce(ret.return_count, 0) as return_count,
      ret.last_returned_at,
      ret.last_return_sale_id,
      att.attached_count,
      sale_ctx.event_last_sale_id,
      ended_ctx.ended_outcome,
      ended_ctx.ended_at
    from lot l
    left join lateral (
      select
        de.event_type as last_event_type,
        de.occurred_at as last_event_at,
        de.actor_user_id as last_actor_user_id
      from domain_event de
      where de.aggregate_type = 'lot'
        and de.aggregate_id = l.id::text
      order by de.occurred_at desc, de.id desc
      limit 1
    ) ev on true
    left join lateral (
      select
        count(*)::int as return_count,
        max(de.occurred_at) as last_returned_at,
        (
          array_agg(de.payload->>'lastSaleId' order by de.occurred_at desc)
          filter (where de.payload->>'lastSaleId' is not null)
        )[1] as last_return_sale_id
      from domain_event de
      where de.aggregate_type = 'lot'
        and de.aggregate_id = l.id::text
        and de.event_type = 'lot.returned_to_inventory'
    ) ret on true
    left join lateral (
      select
        sum(
          case
            when de.event_type = 'lot.attached_to_sale' then 1
            when de.event_type = 'lot.detached_from_sale' then -1
            else 0
          end
        )::int as attached_count
      from domain_event de
      where de.aggregate_type = 'lot'
        and de.aggregate_id = l.id::text
        and de.event_type in ('lot.attached_to_sale', 'lot.detached_from_sale')
    ) att on true
    left join lateral (
      select coalesce(
        (array_agg(de.payload->>'saleId' order by de.occurred_at desc)
          filter (where de.payload->>'saleId' is not null))[1],
        (array_agg(de.payload->>'lastSaleId' order by de.occurred_at desc)
          filter (where de.payload->>'lastSaleId' is not null))[1]
      ) as event_last_sale_id
      from domain_event de
      where de.aggregate_type = 'lot'
        and de.aggregate_id = l.id::text
        and de.event_type in (
          'lot.attached_to_sale',
          'lot.created',
          'lot.published',
          'lot.ended'
        )
    ) sale_ctx on true
    left join lateral (
      select
        de.payload->>'outcome' as ended_outcome,
        coalesce((de.payload->>'endedAt')::timestamptz, de.occurred_at) as ended_at
      from domain_event de
      where de.aggregate_type = 'lot'
        and de.aggregate_id = l.id::text
        and de.event_type = 'lot.ended'
      order by de.occurred_at desc, de.id desc
      limit 1
    ) ended_ctx on true
    where l.deleted_at is null
  `);

  let upserted = 0;

  for (const row of rows) {
    const lastEventType = row.last_event_type ?? "lot.created";
    const lastEventAt = row.last_event_at ?? row.updated_at;
    const lastSaleId = row.last_return_sale_id ?? row.event_last_sale_id ?? row.sale_id;
    const lastSaleOutcome = row.ended_outcome ?? inferOutcome(row.current_status, row.winner_id);
    const attachedCount = Math.max(0, row.attached_count ?? (row.sale_id ? 1 : 0));

    await pool.query(
      `insert into lot_lifecycle_snapshot (
        lot_id,
        current_status,
        last_event_type,
        last_event_at,
        last_actor_user_id,
        last_sale_id,
        last_sale_outcome,
        last_sale_ended_at,
        returned_to_inventory_at,
        return_count,
        attached_count,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $4)
      on conflict (lot_id) do update set
        current_status = excluded.current_status,
        last_event_type = excluded.last_event_type,
        last_event_at = excluded.last_event_at,
        last_actor_user_id = excluded.last_actor_user_id,
        last_sale_id = excluded.last_sale_id,
        last_sale_outcome = excluded.last_sale_outcome,
        last_sale_ended_at = excluded.last_sale_ended_at,
        returned_to_inventory_at = excluded.returned_to_inventory_at,
        return_count = excluded.return_count,
        attached_count = excluded.attached_count,
        updated_at = excluded.updated_at`,
      [
        row.lot_id,
        row.current_status,
        lastEventType,
        lastEventAt,
        row.last_actor_user_id,
        lastSaleId,
        lastSaleOutcome,
        row.ended_at,
        row.last_returned_at,
        row.return_count,
        attachedCount,
      ],
    );
    upserted += 1;
  }

  console.log(`Upserted ${upserted} lot lifecycle snapshot rows`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
