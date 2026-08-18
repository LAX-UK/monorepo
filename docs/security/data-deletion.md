# Data Deletion Procedure

V1 is a manual GDPR deletion workflow.

1. Verify requester identity.
2. Locate the canonical immutable Identity `sub`, Better Auth accounts, and any
   explicit external-account links.
3. Export a deletion evidence bundle for internal audit.
4. Revoke Identity/OAuth sessions and enqueue back-channel logout; disable the
   subject and deliver account-purged SSF where enabled.
5. Anonymise Bid and Shop profiles independently while preserving
   financial/audit integrity where legally required. Do not query product data
   by joining directly to Identity tables.
6. Delete or anonymise linked Zoho Contact/Deal/Sales_Order records.
7. Trigger Xero or other active processor deletion where contracts require it.
8. Reconcile every product by immutable `sub` and record completion date and operator.

**AML retention override.** Source-of-funds evidence (`source_of_funds_document`, `retentionClass: aml_5y`) must **not** be erased within five years of case resolution — UK MLR / GDPR Art 17(3)(b) crime-prevention exemption applies. If a deletion request arrives during the retention window, anonymise non-essential PII on the user record but retain SoF upload objects and audit events until `purgeSourceOfFundsDocumentsJob` runs after the window. Document the refusal rationale in the deletion evidence bundle.

`domain_events` remains append-only. PII in event payloads must be minimized so retained audit rows do not carry unnecessary personal data.
