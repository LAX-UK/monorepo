# Deletion Request

Follow `docs/security/data-deletion.md`.

Operational checklist:

1. Verify requester identity and jurisdiction.
2. Find local user by email and linked `external_accounts`.
3. Export audit bundle.
4. Anonymise local profile fields.
5. Delete/anonymise Zoho records.
6. Brevo: `POST /users/me/delete` emits `user.deletion_requested`; the worker archives the contact in
   Brevo automatically when `MARKETING_CONTACT_SYNC_PROVIDER=brevo`. Confirm in
   `marketing_contact_sync_log` (`action=archive`, `status=archived`) or remove manually in Brevo if
   sync was disabled.
7. Trigger Xero or other active processor deletion procedures where applicable.
8. Record completion and retain minimal legal/audit proof.
