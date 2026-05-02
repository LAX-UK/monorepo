# Data Deletion Procedure

V1 is a manual GDPR deletion workflow.

1. Verify requester identity.
2. Locate the canonical `user.id` plus linked rows in `external_accounts`.
3. Export a deletion evidence bundle for internal audit.
4. Anonymise local PII while preserving financial/audit integrity where legally required.
5. Delete or anonymise linked Zoho Contact/Deal/Sales_Order records.
6. Trigger Shopify/Xero deletion where processor contracts require it.
7. Record completion date and operator.

`domain_events` remains append-only. PII in event payloads must be minimized so retained audit rows do not carry unnecessary personal data.
