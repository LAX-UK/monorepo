# Postmark inbound: replies to enquiry emails

This is the setup the owner does in Postmark and DNS so that a sender's emailed reply to an enquiry email is filed on the enquiry. The receiving side is in the API behind a flag that is off by default. Staff screens for reading and answering replies come in a later change. Never put real values in this repository: the names below are placeholders.

## What it does

- With `ENQUIRY_INBOUND_REPLIES_ENABLED=true`, the enquiry acknowledgement email carries a per-thread `Reply-To`: `<mailbox>+<thread id>-<proof>@<inbound domain>`. The proof is an HMAC of the thread id under `ENQUIRY_REPLY_TOKEN_SECRET`, so the address cannot be guessed from an enquiry reference.
- Postmark posts each received mail to `POST /webhooks/postmark/inbound`. This route is separate from the delivery-event route (`/webhooks/postmark`) and uses its own credentials.
- A reply is filed on the thread only when its address (or, failing that, a quoted `In-Reply-To` / `References` message id) names the thread, the From address is the person who enquired, and it is neither an automatic reply nor an SPF failure. The thread is marked as awaiting a reply, a `marketing_enquiry.customer_replied` event is recorded, and the staff enquiry inbox is emailed.
- Anything else goes to the `enquiry_inbound_quarantine` table for staff review, is never attached to a thread, and is purged after 30 days.
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

The API refuses to start with the flag on and any of the last three missing. Staff alerts need `BID_ENQUIRY_NOTIFICATION_EMAIL`, as for new enquiries.

## Turning it on

1. Run the migration (`0397_enquiry_inbound_replies`, possibly renumbered at ship time) and the role grants (`db:roles`).
2. Set the three variables with the flag still `false`, deploy, then do the Postmark and DNS steps above.
3. Set the flag to `true`. New acknowledgement emails now carry the per-thread `Reply-To`. Emails already sent keep the old `Reply-To`.
4. Send yourself a test enquiry, reply from the same address, and check that the thread shows as awaiting a reply and the staff inbox got the notice.

## Turning it off or rolling back

Set `ENQUIRY_INBOUND_REPLIES_ENABLED=false`: the route returns 404 and new emails carry the usual `Reply-To`. Replies already stored stay. To remove the schema, see `packages/db/drizzle/0397_rollback.sql` (roll the release back first).

## Notes

- A reply sent from a different address than the enquirer's (a forward, a shared inbox) is quarantined as `sender_mismatch`, even with a valid reply address.
- Postmark treats any non-200 as a failure and retries; the route answers 200 for stored, duplicate and quarantined mail, 401 for bad credentials, 413 above 40 MB and 400 for a malformed body.
- Logs carry the outcome and thread id only, never an address, subject or text. Audit events carry ids, the match method and a file count only.
