# Demo seed on test

The full demo seed (GAP-31) writes invented people, sales, Shop orders and one item in each staff
queue. It runs from the **Worker task (test)** workflow, task `demo-full`, and is safe to run again:
every staff queue item is written once and never changed, so work staff do on it is kept.

## Where it may run

The seeds refuse a database unless both are true:

1. The address and environment do not look like production (`APP_ENV`/`NODE_ENV` is not
   `production`/`prod`, and the host name does not contain `prod`).
2. The database itself carries the demo seed mark: one row in `demo_seed_target` (migration 0398)
   that names this database. Production never has a row. A copy restored under another name is
   refused, because its row names the database it was written in.

The Bid seed (`db:seed:demo-full`), the Shop seed (`seed:demo-full`) and the staff queue seeders
check the mark before they write anything.

## Mark the test database (once)

After migration 0398 is applied on test, an operator connects with the **owner** address of the test
database (never production) and runs:

```sql
insert into demo_seed_target (environment, database_name, marked_by)
values ('test', current_database(), '<your name>');
```

Check it with `select * from demo_seed_target;`. For a local database use `'local'`.

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
| LAX Admin: Fulfilment, "To fulfil" | The paid demo print orders |
| LAX Admin: "Failed refunds", `/orders?refund=failed` | A goodwill part refund that cannot be sent (the demo orders have no Stripe payment) |
| LAX Admin: Disputes | An open dispute on a demo print order |

Events the seeds write carry the producer `demo-seed`; the notification fan-out and the collection
notices skip them, so no one is emailed about demo data.
