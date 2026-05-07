# Payout statement PDFs (DigitalOcean Spaces)

## Retention

Statement objects are stored under the key prefix `payout-statements/{legal_entity_id}/{payout_id}.pdf`. **Operational policy:** retain these objects for **seven years** to satisfy UK accounting and tax inspection expectations.

## Lifecycle configuration

Bucket lifecycle rules (transition to Infrequent Access, archive tier, or scheduled deletion after seven years) are configured **outside this repository** in the Spaces bucket policy or Terraform. Engineering ships the key layout and URL persistence on the `payout.statement_url` column only.

## Regeneration

Deleting the object in Spaces does not automatically clear `payout.statement_url`. If an object is removed manually, clear the column (or re-hit the statement endpoint to enqueue a fresh generation job) so clients do not follow a stale URL.
