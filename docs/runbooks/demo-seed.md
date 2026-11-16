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

Every seed that writes accounts, passwords or staff grants checks the mark before it writes
anything, through one guard (`packages/db/src/seed/shared/seed-target-guard.ts`): the dev seed
(`db:seed:dev`, also run by `terraform-test-up` on an empty test database), `db:seed:demo-full`,
`db:seed:demo-topup`, `db:seed:check-accounts`, the Shop `seed:demo-full`,
`seed:acceptance-portal`, `seed:acceptance-staff-operations` and `seed:local-admin-staff`, and the
staff queue seeders. None of them has an override flag.

No seed writes the mark itself, and an address alone never counts: a loopback address can be a
tunnel or port-forward to a remote database. An unmarked database is refused, whatever its address.

### Seeded passwords and staff two-factor

- **Hermetic** (marked `local`, at a loopback address or the Compose `postgres`/`db` service, with
  no `APP_ENV=test`/`production`): seeded sign-ins use the local password (`LOCAL_SEED_PASSWORD`)
  and the dev seed makes staff two-factor optional.
- **Anything else** (including test, and a test database reached through a tunnel): the seeds need
  the `SEED_ACCOUNT_PASSWORD` secret (at least 16 characters, not the local password) for every
  sign-in they create, and the dev seed leaves the staff two-factor policy as it is.

The seed functions take the password from their caller; none of them defaults to the local
password.

## Mark the test database (once)

After migration 0398 is applied on test, an operator connects with the **owner** address of the test
database (never production) and runs the same script CI uses:

```sh
DATABASE_URL=<test owner address> pnpm --filter @auction/db db:seed:mark-demo-target test <operator name>
```

The script applies the production address checks and leaves an existing mark alone. Check it with
`select * from demo_seed_target;`.

Last resort only, if the script cannot be run: connect as the owner and insert the row by hand. This
skips the address checks, so confirm the address is the test database first.

```sql
insert into demo_seed_target (environment, database_name, marked_by)
values ('test', current_database(), '<operator name>');
```

### How each environment gets its mark

- **Local**: `pnpm db:seed` (`db:seed:local`) runs `mark-demo-target local` and then the dev seed;
  `pnpm db:seed:docker` does the same in Compose. `local` is written only at a local address with
  no `APP_ENV=test`/`production`, and only on a database with no users yet. A local database that
  already has users and no mark (one seeded before the mark existed) is refused; if it is yours, mark
  it once with
  `pnpm --filter @auction/db db:seed:mark-demo-target local <your name> --existing-local-database`.
- **CI** (throwaway `localhost` databases in `e2e-pr`, `art-e2e-pr`, `account-e2e-pr`,
  `e2e-stabilization`, `visual-baselines` and the identity preflight): the workflows run
  `db:seed:local` after `db:migrate`, so the fresh database is marked `local` before any seed. Any
  new workflow that seeds a fresh database must do the same; the guard itself is never relaxed.
- **Test** (the shared test database, seeded by **Worker task (test)**): the mark is not added by
  the workflow. The infrastructure owner applies migration 0398 with the test infra apply and then
  marks the database once as above (`'test'`, owner address). Until then the `demo-full` task is
  refused. The Shop seed reads the same mark (`shop_app` has SELECT only), so one mark covers both.

If 0398 is rolled back the mark goes with it; insert it again after the migration is reapplied.

## Live keys outside production

The API, Shop API and worker accept live Stripe keys, and the worker acts on a production Zoho CRM
org, only when `APP_ENV` is exactly `production`. Every other value, and no value, is treated as
"not production": every Stripe key must be a test key (`sk_test_`, `pk_test_`, `rk_test_`), the Shop
Connect platform must be `bid_sandbox`, and any live or canary Zoho CRM mode (and, outside production,
live artwork sync or quality-check reads) needs `ZOHO_CRM_EXPECTED_ORG_TYPE=sandbox`. The rule fails
closed on purpose: a deployed test host with `APP_ENV` unset or mis-set refuses to start with live
keys instead of passing for production. The Shop API also refuses an `APP_ENV` that is set but is
not `production`, `test` or `development` (the API and worker already did). Production must
therefore set `APP_ENV=production` on the API, Shop API and worker.

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
| LAX Admin: "Failed refunds", `/orders?refund=failed` | A goodwill part refund that cannot be sent (the demo orders have no Stripe payment, so a retry fails again without calling Stripe) |
| LAX Admin: Disputes | An open dispute on a demo print order, a different order from the refund; it has no Stripe payment, so there is no "Open in Stripe" link |

Events the seeds write carry the producer `demo-seed`; the notification fan-out and the collection
notices skip them, so no one is emailed about demo data.

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
