# Demo seed on test

The full demo seed (GAP-31) writes invented people, sales, Shop orders and one item in each staff
queue. It runs from the **Worker task (test)** workflow, task `demo-full`, and is safe to run again:
every staff queue item is written once and never changed, so work staff do on it is kept. A row
that has been deleted is written again on the next run (staff cannot delete these rows in the app).

## Where it may run

The seeds refuse a database unless both are true:

1. The address and environment do not look like production (`APP_ENV`/`NODE_ENV` is not
   `production`/`prod`, and the host name does not contain `prod`).
2. The database itself carries the demo seed mark: one row in `demo_seed_target` (migration 0398)
   that names this database. Production never has a row. A copy restored under another name is
   refused, because its row names the database it was written in.

The Bid seed (`db:seed:demo-full`), the Shop seed (`seed:demo-full`, which also fills the Shop
staff queues and the dispatched, returned and reserved states) and the staff queue seeders check
the mark before they write anything.

## Mark the test database (once)

After migration 0398 is applied on test, an operator connects with the **owner** address of the test
database (never production) and runs the same script CI uses:

```sh
DATABASE_URL=<test owner address> pnpm --filter @auction/db db:seed:mark-demo-target test <operator name>
```

The script applies the production address checks and leaves an existing mark alone. Check it with
`select * from demo_seed_target;`. For a local database use `local` instead of `test`.

Last resort only, if the script cannot be run: connect as the owner and insert the row by hand. This
skips the address checks, so confirm the address is the test database first.

```sql
insert into demo_seed_target (environment, database_name, marked_by)
values ('test', current_database(), '<operator name>');
```

### How each environment gets its mark

- **CI** (`account-e2e-pr.yml`, a throwaway database): the workflow runs
  `pnpm --filter @auction/db db:seed:mark-demo-target test ci` after `db:migrate` and before
  `db:seed:demo-full`. The script uses the owner address, applies the same production address checks
  as the seeds, and leaves an existing mark alone. Any new workflow that runs a demo seed on a fresh
  database must run it too; the guard itself is never relaxed.
- **Local**: run the same command with `local`.
- **Test** (the shared test database, seeded by **Worker task (test)**): the mark is not added by
  the workflow. The infrastructure owner applies migration 0398 with the test infra apply and then
  marks the database once as above (`'test'`, owner address). Until then the `demo-full` task is
  refused. The Shop seed reads the same mark (`shop_app` has SELECT only), so one mark covers both.

If 0398 is rolled back the mark goes with it; insert it again after the migration is reapplied.

## What staff see after a run

| Screen | Item |
| --- | --- |
| Purchase problems, Open; Work inbox | A buyer reports a paid lot has not arrived |
| Work inbox, Finance: unapplied money | A bank transfer in a Stripe balance with no invoice |
| Disputes, Needs allocation | A dispute on a "Pay several" charge with two candidate invoices |
| Data requests, Open | A "Download my data" request running late (all deadline alerts already raised) |
| Collection desk (choose "LAX Demo Collection Point", Upcoming) | A visit staff booked for a paid, released lot |
| Lot fulfilment; Work inbox | Two paid lots awaiting release, one ready for collection |
| Submissions, awaiting review; Work inbox | A complete consignment nobody has looked at |
| Private sales, Active | A deal at the offer stage, converted from an enquiry |
| LAX Admin: Fulfilment, "To fulfil" | The paid demo print orders not dispatched |
| LAX Admin: "Failed refunds", `/orders?refund=failed` | A goodwill part refund that cannot be sent, and the cancellation refund of the returned order (£280.00 on the seeded data) (the demo orders have no Stripe payment, so a retry fails again without calling Stripe) |
| LAX Admin: Disputes | An open dispute on a demo print order, a different order from the refund; it has no Stripe payment, so there is no "Open in Stripe" link |
| LAX Admin: Orders, Fulfilment (in transit) | The demo order of "Harbour at Dusk" (artist's proof), order key `seed:edition-order:harbour-at-dusk-artists-proof`, dispatched with carrier "Demo Carrier" and tracking number `DEMO-TRACK-0001`. Its print was confirmed at packing through the packing service, so its print history shows "pack confirmed" by `seed:demo-shop-states` |
| LAX Admin: Orders (order page, returns) | The demo order of "Shoreline Estate" (`seed:edition-order:shoreline-estate`), packed and dispatched the same way, delivered, then cancelled after possession: a return received back on sale, and a cancellation refund recorded as failed (no Stripe payment exists, so it can never be sent) |
| LAX Admin: Original sales (reserved) | "Quiet Orchard" (lax.art original) reserved for an invented buyer ("Demo Original Buyer") at £1,450.00, with no expiry and no invoice. lax.art has no reserved state: the original still shows there as for sale at £1,450. The reservation is visible in LAX Admin only |

The two orders are chosen by their fixed order keys, never by position, so they are always
different orders from the goodwill refund and the dispute of the Shop staff queues.

### Coverage of the GAP-31 states

| State | Seeded? | By |
| --- | --- | --- |
| Purchase problem (staff queue) | Yes | Bid seed, `packages/db/src/seed/demo/queues/purchase-problem.seeder.ts` |
| Unapplied money (staff queue) | Yes | Bid seed, `packages/db/src/seed/demo/queues/unapplied-money.seeder.ts` |
| Data request (staff queue) | Yes | Bid seed, `packages/db/src/seed/demo/queues/data-request.seeder.ts` (goes overdue, see below) |
| Shop order dispatched | Yes | Shop seed, `demo-shop-states-seed.ts` |
| Shop order returned | Yes, received back on sale | Shop seed, `demo-shop-states-seed.ts` |
| Reserved lax.art original | Yes, in LAX Admin | Shop seed, `demo-shop-states-seed.ts`; not shown as reserved on lax.art (no such state exists) |
| A paid or invoiced original, a sent refund, Stripe links | No | Needs real Stripe or Zoho Books objects, see below |
| A return still in transit | No | The seeded return goes on to received |

### What the demo cannot show, and why

- **Money that really moved.** The demo orders and the reserved original have no Stripe payment,
  invoice, Payment Link or Books invoice, and no invented provider id is written for them. The
  refund of the returned order is recorded as failed ("Order missing stripe_payment_intent_id"),
  not sent. Anything that needs a real Stripe or Zoho Books object (a paid or invoiced original, a
  sent refund, "Open in Stripe" links) needs live provider data: create it with Stripe test mode
  and the Shop's own test flow.
- **A return still in transit.** The seeded return is received (the "returned" state). Staff can
  open another by cancelling a delivered demo order after possession in LAX Admin.
- **A reserved original on lax.art.** lax.art has no reserved state (`shop_sale_state` is for
  sale, price on application or sold), so the reserved "Quiet Orchard" still shows there as for sale
  at £1,450. The reservation is visible in LAX Admin only. A public "Reserved" label would be a
  product change, not a seed change.

Events the Bid seeds write carry the producer `demo-seed`; the notification fan-out and the
collection notices skip them, so no one is emailed about demo data. The Shop seed runs real Shop
handlers and services, so its events (such as `shop.fulfilment.dispatched`,
`shop.print.pack_confirmed`, `shop.possession.recorded`, `shop.cancellation.requested` and
`shop.original_sale.reserved`) carry `shop-api`; no email is sent because the seed buyers have no
email address. The Worker's Zoho fulfilment mirror subscribes to some of them, as it already does to
the demo orders' `shop.order.paid`.

## Run it

```sh
DATABASE_URL_SHOP=<test shop address> pnpm --filter @auction/shop-api seed:demo-full
```

It is the Shop half of **Worker task (test)** `demo-full`. Run it again at any time: a step runs
only on a row the seed itself last moved (its audit trail shows `seed:demo-shop-states`), so work
staff did on an item is kept and nothing outside the seed's own rows is touched. The returned order
and the reservation are written once; if staff cancel or complete the reservation it is not made
again, and a later run never sets "Quiet Orchard" (or any seeded original with a live or completed
sale) back to for sale.

If a run stops part-way (a lost connection, say), the next run finishes the remaining steps from
where it stopped. Each step has a fixed idempotency key, so nothing is done twice.

The run prints one line per state it left alone because staff had taken it on (`demo shop state not
seeded: ...`). If a state cannot be seeded at all (a demo order or "Quiet Orchard" is missing, for
example because `seed:catalogue` has not run on this database), the run fails with a message naming
each missing state and exits non-zero.

## Items that go stale (clock-bound)

Because each item is written once, three of them are fixed to the day of the first run and are not
refilled by later runs:

| Item | Shown for about |
| --- | --- |
| Collection booking (slot about 3 days after the first run) | 3 days, then it is no longer "Upcoming" |
| Private sale offer (expires 5 days after the first run) | 5 days, then the offer has lapsed |
| Data request (requested 24 days before, due a month after the first run) | about a week, then it is overdue |

The other items have no date that passes. To show the three again, do not edit them in place. Either
restore a fresh copy of the test database (then mark it, see above) and run the seed, or an operator
deletes only seed-owned rows (ids with the prefixes `df93…` booking, `df97…`/`df98…` deal, `df9a…`
export, and their `demo-seed` events) that staff have not worked on, then runs the seed again. Check
each row is still in its seeded state first (booking `booked`, deal at `offer`, export open); a row
staff have changed is theirs and is left alone. A separate refresh command is deliberately not
provided: rewriting rows that staff may have touched is the risk the insert-once design avoids.
