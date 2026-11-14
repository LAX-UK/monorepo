import { accountingDocument } from "@auction/db/schema";
import { sql } from "drizzle-orm";

/**
 * The domain's `documentsAwaited`, in SQL, for the `accounting_document` row in scope: the kind and
 * LAX reference of each document it waits for. A payment waits for its contact
 * (`payload.contactReference`) and every invoice it is applied to
 * (`payload.allocations[].invoiceReference`); an invoice or credit note waits for its contact;
 * anything else waits for nothing. Shared by every product (Bid and Shop claim through it alike).
 */
const AWAITED = sql`(
  select 'invoice'::text as kind, allocation ->> 'invoiceReference' as reference
    from jsonb_array_elements(
      case when ${accountingDocument.kind} = 'payment'
        then coalesce(${accountingDocument.payload} -> 'allocations', '[]'::jsonb)
        else '[]'::jsonb end
    ) as allocation
  union all
  select 'contact'::text, ${accountingDocument.payload} ->> 'contactReference'
   where ${accountingDocument.kind} in ('invoice', 'credit_note', 'payment')
)`;

/** An awaited document in the same books: product, legal entity, target provider and mode. */
const SAME_BOOKS = sql`awaited.product = ${accountingDocument.product}
        and awaited.legal_entity = ${accountingDocument.legalEntity}
        and awaited.kind = needed.kind
        and awaited.lax_reference = needed.reference
        and awaited.target_provider is not distinct from ${accountingDocument.targetProvider}
        and awaited.target_mode is not distinct from ${accountingDocument.targetMode}`;

/**
 * True when everything the row waits for is `issued` in the same books. Until then the row is
 * not claimable: it waits without an attempt being spent, and the documents behind it are claimed
 * as usual. An awaited document that is not registered yet, is failing or waits for a person keeps
 * it waiting with it.
 */
export const AWAITED_ISSUED = sql`not exists (
  select 1
    from ${AWAITED} as needed
   where not exists (
     select 1
       from accounting_document as awaited
      where ${SAME_BOOKS}
        and awaited.state = 'issued'
   )
)`;

/**
 * True when the row is a payment applied to an invoice that was cancelled in the same books (and
 * none of that reference is issued there). It can never be sent: it is parked for a person
 * (`invoice_cancelled`) instead of waiting for ever.
 */
export const AWAITED_INVOICE_CANCELLED = sql`exists (
  select 1
    from ${AWAITED} as needed
   where needed.kind = 'invoice'
     and exists (
       select 1 from accounting_document as awaited
        where ${SAME_BOOKS} and awaited.state = 'cancelled'
     )
     and not exists (
       select 1 from accounting_document as awaited
        where ${SAME_BOOKS} and awaited.state <> 'cancelled'
     )
)`;
