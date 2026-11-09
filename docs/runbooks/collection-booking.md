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
   `reason: "account_erased"`. The erased person cannot be told. The worker's collection email
   projector sends the cancellation notice from that event to the owners and admins of an
   organisation account; a personal account has nobody left to tell.
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

## Hours, closures and bank holidays

Staff set a place's hours, rules and closures in Bid admin under Collections (the Fulfilment role
changes them; every change asks for a recent sign-in and is written to the audit log).

- **Bank holidays** for England and Wales are worked out by rule in
  `packages/domain/src/working-hours.ts` (`englandAndWalesBankHolidays`) and stored per place as
  closures for the current year and the next two, the first time the place is read in a new year.
  Staff can remove one; a removed holiday is not added back. The rules cover the regular holidays
  and substitute days only. **One-off holidays (a coronation, a jubilee) are not known in advance:**
  when the government announces one, add a closure for it by hand, or add it to the working
  calendar's `extraHolidays`. Check the next two years against gov.uk/bank-holidays each
  November. Replacing the rule table with a gov.uk import is a possible later change.
- **Sale days** are worked out from the sales at the place each time the screen or the booking
  page is read; nothing is stored. Staff open a sale day with an extra opening ("Open anyway").
- A change to the hours or a closure that leaves booked visits outside what is offered lists them
  and waits for staff to choose: keep them, or cancel them. Nothing is cancelled without that
  choice, and the choice names the visits staff were shown (`affectedBookings: { choice,
  bookingIds }`). If a visit was booked in the meantime the API answers 409 `bookings_affected`
  again with the new list, whichever choice was sent.
- The change, the cancellations and their audit events are written in one transaction. Under a
  per-place advisory lock (taken by booking, changing and every staff change to a place) the
  affected visits are read once more before anything is written, so a visit booked while staff were
  deciding cannot be missed or cancelled unseen. The place's audit event records "n affected, m
  cancelled". Removing a closure is a `POST .../exceptions/:id/remove`, because it carries the
  choice. A cancelled visit records `collection.booking.cancelled` with the reason
  `hours_changed`, `closure_added` or `opening_removed`; the rebooking email is sent from that
  event.

## Emails

The worker's `collection_booking_notify` projector reads the audit events that are written in the
same transaction as a booking (`created`, `changed`, `cancelled`) and sends the email for each, so a
booking and its email cannot disagree and a retry sends nothing twice (the outbox key names the
event and the address).

| Event | Email | Calendar entry |
| --- | --- | --- |
| Booked | Booked, to the person who booked (to the account's owners and admins if the desk booked it, or the booker has gone). A named collector with an address also gets "You're collecting for ..." with no prices and no link into the account | `REQUEST`, one per recipient |
| Changed | Changed, with the time it moved from | `REQUEST`, same UID, next `SEQUENCE` |
| Cancelled | Cancelled, worded by who ended it: the buyer, the gallery (hours or a closure changed, with its reason), or the account (the booker erased it). A collector is told they need not come | `CANCEL` |

The calendar invites come from `COLLECTION_ORGANIZER_EMAIL` / `COLLECTION_ORGANIZER_NAME` (default
`collections@lax.bid`, "LAX Bid", the product's name). Both have safe defaults, so nothing has to be set
for invites to work; changing them in an environment is an infrastructure change. Mail clients need
an organizer to update or remove an entry, so keep it an address that exists.

**Day-before reminder.** A repeat job (`collection-reminders`, every 15 minutes) emails the buyer
about tomorrow's visits from 09:00 London time. A visit booked after that morning's 09:00 gets none
(its confirmation has just gone); a visit that moves is reminded for its new time. The key is the
visit and its start, so any number of sweeps sends one. If reminders stop, check the queue's
heartbeat (`collection-reminders`) before anything else.

**Limits.** An account can book, change and cancel 20 times an hour in total (HTTP 429 with
`Retry-After`), and hold at most the place's "visits an account can hold" at once (default 5; Bid
admin, Collections, Hours and rules). If the counter (Redis) is unreachable the limit is skipped
and booking carries on.

## Rolling back

`0334_rollback.sql` drops the tables and `lot_fulfilment.collected_by_user_id`. It refuses while
any visit is booked: cancel those first, or move the clients to email. Roll back the application
release first.
