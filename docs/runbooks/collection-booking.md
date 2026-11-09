# Collection booking

Buyers book a time to collect paid works from the gallery; staff set the hours and hand works over
at the desk. This page covers the data and what happens to it when someone erases their account.

## The data

| Table | What it holds |
| --- | --- |
| `collection_place` | One row per venue: visit length, places at once, the cut-off, the booking window, the undo minutes and the **online-booking switch** (off until staff turn it on) |
| `collection_weekly_hours` | The regular opening hours, London wall-clock times |
| `collection_exception` | Closures and extra openings; bank holidays and sale days carry their source |
| `collection_booking` | One visit. Holds one numbered place; a partial unique index on (venue, slot start, seat) while the booking is `booked` is what stops two people taking the same place |
| `collection_booking_lot` | The lots in a visit. A lot is in at most one live booking |

A booking made twice with the same idempotency key is one booking. The key also stores a digest of
the request: the same key with a different request is refused (the API answers 409
`idempotency_key_reused`), never replayed.

Until a place is set up in Bid admin, the offer for a purchase uses the `COLLECTION_*` environment
variables. Once a place exists, its own switch, capacity and hours decide.

## Personal data

A booking holds the collector's name, email and company. The collector may be the buyer, a member
of their organisation, or a third party the buyer named, and may have no account. None of it is put
into a domain event.

### When a person erases their account

Identity's `user.identity_deleted` event runs Bid's anonymisation
(`apps/worker/src/anonymisation/collection-booking-erasure.ts`). For every booking the person made,
authorised or is named to collect at, and every booking on their personal account:

1. **A live (`booked`) visit is cancelled first**, never scrubbed. Its lots are released and a
   `collection.booking.cancelled` event is recorded with `cancelledVia: "system"` and
   `reason: "account_erased"`. The erased person cannot be told; the notice to the account's other
   people (or the gallery) is sent from that event by the notification work in the emails PR.
2. **A visit that ended with nothing handed over** (`cancelled`, `not_collected`) loses the
   collector's name (replaced by "Deleted user XXXX" for the person's own, "Deleted collector" for
   a third party), email and company at once.
3. **A visit where works were handed over** (`collected`, `partly_collected`) loses the collector's
   email and company at once. The collector's **name and the kind of ID checked are kept** as the
   record of who took the works, for `COLLECTION_HANDOVER_RETENTION_YEARS` after the hand-over.

Each step is idempotent: running the erasure again changes nothing.

### The retention purge

The worker's daily `purge-collection-handover` job clears the kept name (to "Deleted collector")
and the ID type on hand-overs whose account has been erased and whose hand-over is older than
`COLLECTION_HANDOVER_RETENTION_YEARS` (default 6, minimum 3, maximum 30). It never touches the
hand-over record of someone whose account is open.

| Variable | Default | Meaning |
| --- | --- | --- |
| `COLLECTION_HANDOVER_RETENTION_YEARS` | 6 | Years the name and ID type of a hand-over are kept after the person's account is erased |

The retention period is a business and legal decision. The default of six years is the usual
limitation period for contract claims in England; confirm it with the compliance adviser (the same
question as whether in-product authorisation counts as written authorisation) before relying on it.

### Download my data

The `collections` category lists the bookings a person made, authorised or is named to collect at,
with the collector details they typed in. It never includes another member's bookings, and a
booking made by another member shows only that it was made by "another member", not who.

## Rolling back

`0334_rollback.sql` drops the tables and `lot_fulfilment.collected_by_user_id`. It refuses while
any visit is booked: cancel those first, or move the clients to email. Roll back the application
release first.
