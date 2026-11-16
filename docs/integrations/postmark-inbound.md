# Postmark inbound: replies to enquiry emails

This is the setup the owner does in Postmark and DNS so that a sender's emailed reply to an enquiry email is filed on the enquiry. The receiving side is in the API behind a flag that is off by default. Staff read replies on the enquiry record and review held email under **Enquiries › Held email** in Bid admin. Staff still answer from their own mail: sending replies from the product comes in a later change. Never put real values in this repository: the names below are placeholders.

## What it does

- With `ENQUIRY_INBOUND_REPLIES_ENABLED=true`, the enquiry acknowledgement email carries a per-thread `Reply-To`: `<mailbox>+<thread id>-<proof>@<inbound domain>`. The proof is an HMAC of the thread id under `ENQUIRY_REPLY_TOKEN_SECRET`, so the address cannot be guessed from an enquiry reference.
- Postmark posts each received mail to `POST /webhooks/postmark/inbound`. This route is separate from the delivery-event route (`/webhooks/postmark`) and uses its own credentials.
- A reply is filed on the thread only when its address (or, failing that, a quoted `In-Reply-To` / `References` message id) names the thread, the From address is the person who enquired, it is not an automatic reply, and its sender is authenticated: SPF passed for a domain aligned with the From address, or a DKIM signature for a domain aligned with the From address passed. The SPF and DKIM results are recorded on every row, filed or held. Mail without either pass is held as `unauthenticated` (or `spf_failed` for an SPF fail or softfail).
- Only the receiving server's own results are believed. For SPF that is the topmost `Received-SPF` header, and only when its `receiver=` is Postmark's inbound domain (`inbound.postmarkapp.com`, or `ENQUIRY_INBOUND_SPF_RECEIVER`); any other `Received-SPF` header counts as no result. An SPF pass whose checked domain (`envelope-from`, or the HELO name when there is none) does not align with the From domain is recorded as `pass_unaligned` and does not authenticate the sender. For DKIM it is the topmost `Authentication-Results` header with the configured authserv-id. Alignment is relaxed (the same domain, or one a subdomain of the other) and does not consult the public suffix list. The thread is marked as awaiting a reply, a `marketing_enquiry.customer_replied` event is recorded, and the staff enquiry inbox is emailed.
- Anything else goes to the `enquiry_inbound_quarantine` table for staff review, is never attached to a thread on its own, and carries a `purge_at` date 30 days out. Staff with enquiry access read it; staff who can work enquiries attach it to one enquiry or discard it, after a confirmation and with a reason, and both are audited with who did it and the reason they gave. Mail whose sender is not verified as the enquiry's client (held for a sender reason, without an aligned SPF or DKIM pass, or from another address) is attached only after the person ticks an explicit confirmation; on the thread it is labelled "Sender not verified" with why it was held and the reason given. Held mail is never attached to an erased enquiry, and mail naming an erased enquiry is shown as unmatched. The worker's `purge-enquiry-inbound-quarantine` job deletes rows past `purge_at` once a day (03:40 London), reviewed or not, and logs counts only.
- The enquiry stays marked as waiting for an answer ("Client replied") until staff move it to Waiting on client, close it or convert it.
- Only plain text is stored (HTML is stripped, 20,000 characters at most). Attachments are recorded as metadata only (name, type, size); the files are not downloaded or stored.
- Replays are harmless: Postmark's `MessageID` is unique, so a redelivery changes nothing and sends no second notice.

## Steps in Postmark

1. Open the server that sends enquiry mail (the transactional stream's server) and choose **Default Inbound Stream** (or the inbound stream you use).
2. Set the **Inbound webhook** URL to:

   `https://<INBOUND_USER>:<INBOUND_PASSWORD>@<API_HOST>/webhooks/postmark/inbound`

   Postmark sends the user and password as HTTP Basic Auth. Choose a fresh user and a long random password; do not reuse the delivery webhook's credentials.
3. Keep **Include raw email content in JSON payload** off. Leave spam filtering on if you want it; it does not change what this route needs.
4. Choose how mail reaches Postmark (pick one):
   - **Inbound domain (recommended).** Under the inbound stream's **Settings**, set the inbound domain forwarding to `<INBOUND_DOMAIN>`, a subdomain used for nothing else, for example `inbound.<YOUR_DOMAIN>`. Add the MX record in DNS (below). Any address at that domain then reaches the webhook.
   - **Forwarding address.** Use the `<hash>@inbound.postmarkapp.com` address Postmark gives you and set `ENQUIRY_REPLY_TO_ADDRESS` to it. Plus-addressing works on it, so `<hash>+<tag>@inbound.postmarkapp.com` still arrives.
5. Use **Check** / send a test message from the inbound stream's setup page to confirm Postmark receives a 200 from the webhook (it will be quarantined as unmatched, which is expected for a test).

## DNS

Add one MX record on the inbound subdomain only (never on the root domain, which would move normal mail to Postmark):

| Name | Type | Priority | Value |
| --- | --- | --- | --- |
| `<INBOUND_DOMAIN>` | MX | 10 | `inbound.postmarkapp.com` |

The existing sender domain's SPF, DKIM and DMARC records are unchanged.

## Environment variables (API service)

| Name | Value |
| --- | --- |
| `ENQUIRY_INBOUND_REPLIES_ENABLED` | `true` to turn it on; `false` (the default) leaves the route returning 404 and the emails unchanged |
| `ENQUIRY_REPLY_TO_ADDRESS` | `<MAILBOX>@<INBOUND_DOMAIN>`, for example `replies@<INBOUND_DOMAIN>` |
| `ENQUIRY_REPLY_TOKEN_SECRET` | a random string of 32 characters or more, kept secret. Changing it stops older reply addresses matching (those replies fall back to In-Reply-To or quarantine) |
| `POSTMARK_INBOUND_WEBHOOK_BASIC_AUTH` | `<INBOUND_USER>:<INBOUND_PASSWORD>`, the same credentials as in the webhook URL |
| `ENQUIRY_INBOUND_AUTHSERV_ID` | Optional. The authserv-id at the start of the receiving server's `Authentication-Results` header, as it appears on a test message. Only the topmost header with this id is believed for DKIM. Unset: only an SPF pass files a reply on its own |
| `ENQUIRY_INBOUND_SPF_RECEIVER` | Optional. The domain of the `receiver=` in the receiving server's `Received-SPF` header. Unset: `inbound.postmarkapp.com`, which is what Postmark writes. Only change it if a test message shows a different receiver |

The API refuses to start with the flag on and any of the last three missing. Staff alerts need `BID_ENQUIRY_NOTIFICATION_EMAIL`, as for new enquiries.

## Turning it on

1. Run the migrations (`0397_enquiry_inbound_replies` and `0398_enquiry_inbound_review`, possibly renumbered at ship time) and the role grants (`db:roles`). Check the worker is running, so the daily quarantine purge runs.
2. Add `purge-enquiry-inbound-quarantine` to `SENTRY_MONITOR_SLUGS` on the worker and create the Sentry cron monitor (daily 03:40 Europe/London, about 30 minutes margin); without the entry the purge runs unmonitored. See [Monitoring alerts](../runbooks/monitoring-alerts.md#held-enquiry-email-purge-purge-enquiry-inbound-quarantine).
3. Set the three variables with the flag still `false`, deploy, then do the Postmark and DNS steps above. On the test message, check the `Received-SPF` header's `receiver=` is at `inbound.postmarkapp.com` (or set `ENQUIRY_INBOUND_SPF_RECEIVER`).
4. Set the flag to `true`. New acknowledgement emails now carry the per-thread `Reply-To`. Emails already sent keep the old `Reply-To`.
5. Send yourself a test enquiry, reply from the same address, and check that the thread shows as awaiting a reply and the staff inbox got the notice.

## Turning it off or rolling back

Set `ENQUIRY_INBOUND_REPLIES_ENABLED=false`: the route returns 404 and new emails carry the usual `Reply-To`. Replies already stored stay. To remove the schema, run `packages/db/drizzle/0398_rollback.sql` and then `0397_rollback.sql` (roll the release back first).

## Notes

- A reply sent from a different address than the enquirer's (a forward, a shared inbox) is quarantined as `sender_mismatch`, even with a valid reply address.
- Postmark treats any non-200 as a failure and retries; the route answers 200 for stored, duplicate and quarantined mail, 401 for bad credentials, 413 above 40 MB and 400 for a malformed body.
- Logs carry the outcome and thread id only, never an address, subject or text. Audit events carry ids, codes (the match method, why mail was held, the SPF and DKIM results, whether the sender was verified), a file count and, for staff review, the reason staff typed; never the sender's address.
- Staff-run enquiry erasure (Data requests › erase enquiries) deletes the held mail suspected to belong to the erased enquiries and all held mail from the erased address, even when no enquiry could be erased. It runs in the API as `api_app`, which holds DELETE on `enquiry_inbound_quarantine` for that reason only.
- Erasure (staff-run, and the worker's scheduled erasure) also replaces the reason staff typed when reviewing held mail, wherever it can name the sender: on the attached message (`review_reason`) and in the `marketing_enquiry.inbound_attached` and `.inbound_discarded` events for the erased enquiries and the erased held mail. Only the `reviewReason` value in those payloads changes, to `[Removed]`; the event and its ids and codes stay. This is the one rewrite of `domain_events` payloads; a discard event whose held row was already purged (after 30 days) can no longer be tied to the person, so the attach and discard dialogs tell staff not to put the sender's name, address or phone number in the reason.
- Attaching re-reads and locks the target enquiry inside the transaction, before the held row; erasure locks the enquiries it erases first as well, so an attach cannot land on an enquiry erased in the meantime, and the two cannot deadlock.
