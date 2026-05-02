# Zoho Outage

Symptoms:

- Worker logs show repeated Zoho 5xx/429.
- `domain_events` cursor lag grows.

Actions:

1. Confirm Zoho EU status.
2. Keep API/webhooks online; do not drop incoming events.
3. Scale `apps/worker` horizontally only after Zoho recovers or if backlog processing is CPU-bound.
4. Rewind only the `zoho` projector cursor if replay is needed.
5. Verify Contacts/Deals/Sales_Orders counts after recovery.
