# Marketing audience

The marketing audience lives in **Zoho CRM** and **Zoho Campaigns**. The worker's Zoho projector
syncs registered users into Zoho CRM, and Zoho Campaigns builds its audience from the CRM.
Newsletter sign-ups reach Zoho Campaigns through the `marketing-sync` queue
(`zoho-campaigns-sync` job). See `docs/integrations/zoho.md`.

This platform has no other marketing-contacts provider. The earlier interim sync to a separate
ESP (worker projector, queue job, adapter and inbound webhook) has been removed, along with its
audit table.

Transactional and notification email stays on Postmark (`docs/integrations/email.md`).

## Opt-outs

`email_suppression` is the platform's suppression list and is honoured by every send path in this
repository. Zoho Campaigns unsubscribes and bounces are not yet written back to it. When Zoho
Campaigns is switched on for lifecycle sending, add an inbound ingest that maps Campaigns opt-outs
and hard bounces into `email_suppression` (the Postmark webhook ingest is the pattern to follow).
