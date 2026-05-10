# Test campaign ops pack

Operational playbook for a **controlled external** test campaign (real or near-real money, invited participants). Owner: **Head of Ops** (delegate: on-call engineer).

---

## 1. Participant comms templates

### Welcome (email)

- **Subject:** `Welcome to the LAX private test auction — {{campaign_name}}`
- **Body:** Short intro, link to `https://lax.bid`, support email `support@lax.bid`, expectations (feedback window, no resale guarantees during test), link to Conditions of Business.
- **CTA:** “Complete identity verification” → `/dashboard/verify-identity` (if required for your cohort).

### Support contact (pinned in campaign Slack / email footer)

- **Primary:** `support@lax.bid` (monitored business hours UK).
- **Escalation:** `OPS_ONCALL_EMAIL` (from production env) for Sev-1 payment/settlement issues.

### Mid-campaign nudge (day 7 optional)

- **Subject:** `Quick check-in — how is bidding on LAX?`
- **CTA:** Short Google Form link or `mailto:support@lax.bid?subject=Test%20campaign%20feedback`.

### Feedback request (end)

- **Subject:** `Test campaign wrap — we need your candid feedback`
- **Ask:** latency, clarity of checkout, invoice/payment confusion, mobile issues.

### Wind-down

- **Subject:** `Test campaign closed — what happens next`
- **Content:** Data retention summary (see §6), thank-you, optional incentive disclosure.

---

## 2. Daily health checklist (each morning UK)

Run in order; record initials + time in ops log.

| # | Check | Where / how | Green threshold |
|---|--------|-------------|-------------------|
| 1 | **Sentry** new issues (24h) | Sentry → Issues → filter `environment:production`, `is:unresolved` | No new **money-path** regressions (payments, payouts, webhooks) |
| 2 | **API** error rate | Sentry performance or DO App metrics | 5xx &lt; 0.5% of requests |
| 3 | **Postmark** bounces / spam | Postmark → Activity | Bounce rate &lt; 2% for campaign stream |
| 4 | **Stripe** webhooks | Stripe Dashboard → Developers → Webhooks | &gt; 99% delivery success rolling 24h |
| 5 | **Xero** invoice sync | Sample unpaid vs Xero | No systematic “stuck pending” payments |
| 6 | **BullMQ** backlog | Redis `LLEN bull:payout-settlement:*` + worker logs | `wait` + `active` &lt; 10 combined sustained 30m (see [scale-monitoring](./scale-monitoring.md)) |
| 7 | **KYC** queue | Admin → manual review / Identity | Queue not growing unbounded |
| 8 | **Lot state** sanity | SQL spot-check: no `live` lots past `end_at` | Zero rows |
| 9 | **Uptime** | DO monitors / Cloudflare health | All green |

Example lot drift query (read-only):

```sql
SELECT id, status, end_at
FROM lot
WHERE status = 'live' AND end_at < now() AT TIME ZONE 'utc'
LIMIT 20;
```

---

## 3. Kill switches

### Disable bidding on a single lot

- **Preferred:** Admin sale tooling — `PATCH` sale-scoped lot status via `apps/api/src/routes/sales.ts` (`/:id/lots/:lotId/status`) with operator role; set status to a non-biddable state per product rules (e.g. `paused` / `cancelled` if supported).
- **Emergency SQL (destructive — legal review):** `UPDATE lot SET status = 'cancelled' WHERE id = $id;` — only with engineering + comms lead sign-off.

### Withdraw a lot / item from sale

- Use admin flows tied to submissions (`POST` withdraw on submissions route family in `apps/api/src/routes/submissions.ts`).
- Confirm downstream domain events and search index updates.

### Halt new settlements / payout batch

- **Soft:** Pause worker App Platform instance or set `CRON_INTERNAL_SECRET` to new value in **API + worker** together so heartbeat jobs stop calling `POST /internal/jobs/bulk-payout-settlement`, then redeploy.
- **Hard:** Scale worker component to 0 in DO (stops all BullMQ consumers) — coordinated maintenance only.

### Suspend a user

- `POST /admin/users/:userId/suspend` (and unsuspend) — `apps/api/src/routes/admin.ts` (`suspend` / `unsuspend`).

### Suspend a legal entity (organisation)

- Use admin legal-entity / membership flows (same admin router family); confirm bids blocked for members of that entity.

---

## 4. Data isolation plan

| Layer | Approach |
|-------|-----------|
| **Auctions / lots** | Tag campaign inventory with a dedicated `sale_id` or naming prefix `TEST-CAMP-2026-*` in titles; maintain a spreadsheet mapping `lot.id` ↔ participant cohort. |
| **Analytics** | Filter Metabase / internal dashboards with `sale_id IN (...)` for campaign scope. |
| **Environments** | Prefer **test** stack (`test.lax.bid`) for dry-runs; production campaign uses real Stripe/Xero only after §3 checks pass. |
| **Export** | Weekly CSV export of campaign lots + payments to cold storage for post-mortem. |

---

## 5. Success vs stop criteria

### Success (campaign may continue)

- Median bid placement latency &lt; **800ms** server-side (API histogram `auction_api_http_request_duration_seconds` for `/bids`).
- **Zero** Sev-1 incidents (defined: money loss, mass auth outage, data leak).
- Payout failure rate **0** in rolling 7 days OR each failure has documented owner + ETA.

### Stop (halt bidding / escalate war room)

- Any **unexplained** duplicate charge or settlement double-pay.
- `payout-settlement` queue depth **&gt; 10** for **&gt; 30 minutes** with jobs failing.
- Stripe webhook delivery success **&lt; 95%** over 6 hours.
- **Legal / compliance** signal (e.g. regulator inquiry) — immediate pause + comms freeze.

---

## 6. Post-campaign cleanup

1. **Comms:** send wind-down template (§1).
2. **Data:** archive campaign `sale_id` snapshot to object storage; retain **5 years** for AML-relevant payment records per policy (see [aml-workflow](./aml-workflow.md)).
3. **Accounts:** disable test-only OAuth clients; rotate webhooks if keys were exposed during support.
4. **Feature flags:** revert any temporary `REQUIRE_EMAIL_VERIFICATION` or rate-limit tweaks documented during campaign.
5. **Retro:** 60-minute internal retro within 5 business days; file action items in tracker.

---

## Related runbooks

- [Postgres backup restore](./postgres-backup-restore.md)
- [Buyer payment flow](./buyer-payment-flow.md)
- [Scale monitoring](./scale-monitoring.md)
- [On-call](./on-call.md)
