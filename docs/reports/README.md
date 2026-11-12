# Local reports

Nothing generated from live data belongs in git. Reconciliation reports and snapshots list buyers'
names, email addresses and account identifiers, which are personal data. This folder is ignored
except for this file (see `.gitignore`), so a report written here stays on your machine.

## Regenerating a reconciliation report

The reports for LAX001 were ad-hoc, read-only queries against a copy of the database; there is no
committed generator. To produce one again:

1. Use a read-only connection to a **restored copy** or the staging database, never production
   directly.
2. For a sale, query its lots, winning bids, `payment` rows, `bid_invoice` rows and the
   payment-due / lot-won notifications, and roll them up per buyer.
3. Redact personal data **before** the file is written, and again before it is shared:
   - buyer name: initials only (`R. R.`) or the legal-entity id;
   - email: drop it, or keep a short hash such as the first 8 hex chars of its SHA-256;
   - user ids, addresses and phone numbers: omit.
4. Save the file in this folder (ignored by git) and delete it when the reconciliation is closed.

Totals, counts, statuses and amounts need no redaction and are what a review normally needs.

## If a report was committed by mistake

Remove it with `git rm`, add its pattern to `.gitignore`, and tell the owner: deleting a file does
not remove it from history. Whether to purge history is the owner's decision.
