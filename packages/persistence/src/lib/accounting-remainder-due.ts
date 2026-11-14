import { accountingDocument, accountingDocumentEvent } from "@auction/db/schema";
import { and, eq, like, notExists, sql } from "drizzle-orm";

const d = accountingDocument;
const e = accountingDocumentEvent;

/** The history action that settles a remainder (migration 0383). */
export const APPLY_REMAINDER = "apply_remainder";

/** Shop outside-UK delivery invoices: `LAX-SHOP-INV-<order>-delivery`. */
export const DELIVERY_INVOICE = and(
  eq(d.product, "shop"),
  eq(d.kind, "invoice"),
  like(d.laxReference, "LAX-SHOP-INV-%-delivery"),
);

/** No `apply_remainder` in the invoice's history yet. */
export const UNSETTLED = notExists(
  sql`(select 1 from ${e} where ${e.documentId} = ${d.id} and ${e.action} = ${APPLY_REMAINDER})`,
);

/**
 * The order's payment (`LAX-SHOP-PAY-<order>`) is issued in the same books as the delivery
 * invoice: until it is, there is nothing to apply, and the invoice is not listed (so it never
 * holds a place at the head of the list).
 */
export const PAYMENT_ISSUED = sql`exists (
  select 1 from ${d} p
   where p.product = ${d.product}
     and p.legal_entity = ${d.legalEntity}
     and p.kind = 'payment'
     and p.state = 'issued'
     and p.lax_reference =
       'LAX-SHOP-PAY-' || substring(${d.laxReference} from '^LAX-SHOP-INV-(.+)-delivery$')
     and p.target_provider is not distinct from ${d.targetProvider}
     and p.target_mode is not distinct from ${d.targetMode})`;

/** When the document was first issued (its history's first move to `issued`). */
export const ISSUED_AT = sql<Date>`(
  select min(${e.occurredAt}) from ${e}
   where ${e.documentId} = ${d.id} and ${e.toState} = 'issued')`;
