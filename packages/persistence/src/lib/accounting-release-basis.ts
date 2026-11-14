import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";
import type { ReleaseBasis } from "../interfaces/accounting.js";

type Executor = Pick<Database, "execute">;

/**
 * The stored rows a release of a parked document is decided on, as one text: the same text twice
 * means the rows did not change in between. With `lock`, each row is also held `FOR SHARE` (inside
 * the release's transaction), so nothing can change them until the move has committed.
 *
 * - A single Bid payment: the payment and the Bid invoice it pays (`voided_at` decides
 *   `invoice_cancelled`).
 * - A "Pay several" group (its payment, or its delivery invoice): the group, its member payments,
 *   their Bid invoices, and its `payment_group_delivery` rows.
 * - A Shop order's outside-UK delivery: the order's stored delivery, read (and held) through
 *   migration 0383's definer function, as api_app may not lock a Shop row itself.
 *
 * Null when a row it needs is missing (the document can no longer be rebuilt).
 */
export async function readReleaseBasis(
  db: Executor,
  basis: ReleaseBasis,
  lock: boolean,
): Promise<string | null> {
  const forShare = lock ? sql` for share` : sql``;
  const rows = async (query: ReturnType<typeof sql>) =>
    (await db.execute<{ row: string }>(query)).rows.map((r) => r.row);

  if (basis.kind === "shop_order") {
    const [row] = await rows(
      sql`select accounting_release_shop_order_basis(${basis.orderId}::uuid) as row`,
    );
    return row ?? null;
  }
  if (basis.kind === "bid_payment") {
    const [payment] = await rows(sql`
      select jsonb_build_object('id', p.id, 'invoice', p.invoice_id, 'group', p.payment_group_id,
               'amount', p.amount)::text as row
        from payment p where p.id = ${basis.paymentId}::uuid${forShare}`);
    if (!payment) return null;
    const invoices = await rows(sql`
      select jsonb_build_object('id', i.id, 'voided', i.voided_at, 'raised', i.raised_at,
               'due', i.due_at, 'buyer', i.buyer_legal_entity_id)::text as row
        from bid_invoice i
       where i.id = (select invoice_id from payment where id = ${basis.paymentId}::uuid)${forShare}`);
    return JSON.stringify({ payment, invoices });
  }
  const [group] = await rows(sql`
    select jsonb_build_object('id', g.id, 'status', g.status, 'currency', g.currency,
             'buyer', g.buyer_legal_entity_id, 'total', g.total_amount,
             'settled', g.settled_at)::text as row
      from payment_group g where g.id = ${basis.groupId}::uuid${forShare}`);
  if (!group) return null;
  const members = await rows(sql`
    select jsonb_build_object('id', p.id, 'invoice', p.invoice_id, 'amount', p.amount)::text as row
      from payment p where p.payment_group_id = ${basis.groupId}::uuid
     order by p.id${forShare}`);
  const invoices = await rows(sql`
    select jsonb_build_object('id', i.id, 'voided', i.voided_at, 'raised', i.raised_at,
             'due', i.due_at, 'buyer', i.buyer_legal_entity_id)::text as row
      from bid_invoice i
     where i.id in (select invoice_id from payment where payment_group_id = ${basis.groupId}::uuid)
     order by i.id${forShare}`);
  const deliveries = await rows(sql`
    select jsonb_build_object('quote', d.delivery_quote_id, 'lot', d.lot_id,
             'amount', d.amount)::text as row
      from payment_group_delivery d where d.payment_group_id = ${basis.groupId}::uuid
     order by d.delivery_quote_id${forShare}`);
  return JSON.stringify({ group, members, invoices, deliveries });
}
