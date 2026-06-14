# Data Deletion Procedure

V1 is a manual GDPR deletion workflow.

1. Verify requester identity.
2. Locate the canonical `user.id` plus linked rows in `external_accounts`.
3. Export a deletion evidence bundle for internal audit.
4. Anonymise local PII while preserving financial/audit integrity where legally required.
5. Delete or anonymise linked Zoho Contact/Deal/Sales_Order records.
6. Trigger Shopify/Xero deletion where processor contracts require it.
7. Record completion date and operator.

**AML retention override.** Source-of-funds evidence (`source_of_funds_document`, `retentionClass: aml_5y`) must **not** be erased within five years of case resolution — UK MLR / GDPR Art 17(3)(b) crime-prevention exemption applies. If a deletion request arrives during the retention window, anonymise non-essential PII on the user record but retain SoF upload objects and audit events until `purgeSourceOfFundsDocumentsJob` runs after the window. Document the refusal rationale in the deletion evidence bundle.

`domain_events` remains append-only. PII in event payloads must be minimized so retained audit rows do not carry unnecessary personal data.
