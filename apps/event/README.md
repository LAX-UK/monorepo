# LAX opening-event RSVP (`event.lax.bid`)

Static Vite microsite for the LAX 001 opening invitation. Ops shares `https://event.lax.bid#rsvp` directly.

The microsite uses the generic **onsite events** API (`/events/:slug/*`). Segment options, venue, dress code, and RSVP close time come from the `onsite_event` registry row (`lax001`).

## Guest flow

1. **Email** — enter lax.bid account email (no password)
2. **Existing client** → attendance form
3. **New guest** → guided to create account, then auto-resume via `?email=` in the return URL
4. **Confirm** → HTML email with embedded QR + pass link; ops copy to the event's `ops_email`

Any registered lax.bid client can RSVP.

## Entry pass (`/pass/:token`)

After RSVP, guests receive `https://event.lax.bid/pass/{token}`.

| Feature | Notes |
|---------|--------|
| QR code | Rendered from API `qr.svg`; show at registration |
| Add to calendar | Downloads `.ics` for the guest's segment |
| Refresh pass | Pulls latest check-in status from API |

## API (public)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/events/lax001/config` | Title, segment options, RSVP open/closed |
| `POST` | `/events/lax001/lookup` | `{ email }` — rate-limited per IP and email |
| `POST` | `/events/lax001/rsvp` | `{ email, attendanceSegment, plusOne, plusOneGuestName?, notes? }` |
| `GET` | `/events/lax001/pass/:token` | Pass JSON (guest name, QR URL, venue, check-in status) |
| `GET` | `/events/lax001/pass/:token/qr.svg` | QR SVG image |

## Admin (staff)

| Method | Path |
|--------|------|
| `GET` | `/admin/event-rsvps` |
| `GET` | `/admin/event-rsvps/lax001/rsvps` |
| `GET` | `/admin/event-rsvps/lax001/rsvps/export` |
| `POST` | `/admin/event-rsvps/lax001/rsvps/:rsvpId/resend-pass` |
| `GET` | `/admin/event-rsvps/lax001/check-in/stats` |
| `GET` | `/admin/event-rsvps/lax001/check-in/search?q=` |
| `POST` | `/admin/event-rsvps/lax001/check-in` |
| `PATCH` | `/admin/event-rsvps/lax001/check-in/dry-run` |

Web UI:

- `/admin/event-rsvps` → RSVP table + resend pass
- `/admin/event-rsvps/lax001/check-in` → QR scanner (BarcodeDetector + ZXing fallback), search, dry-run rehearsal mode

## Local development

```bash
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm --filter @auction/api dev   # port 3001
pnpm --filter @auction/event dev # port 3003
```

Open `http://localhost:3003`. In dev, Vite proxies onsite-event **API** paths (`/events/:slug/config|lookup|rsvp|pass/...`) and `/sales` to `http://localhost:3001`. Static invitation images stay at `/events/lax001/*` from `public/`.

Optional overrides: `apps/event/.env.development` (`VITE_API_BASE`, `VITE_WEB_ORIGIN`, `VITE_EVENT_ORIGIN`).

## Production deploy

1. Run DB migrations through `0101_onsite_event_pass_metadata` (after `0099`, `0100`)
2. Set the API-owned `CHECK_IN_TOKEN_SECRET` (≥16 chars locally, ≥48 in production)
3. Confirm `EMAIL_PROVIDER=postmark` and `POSTMARK_SERVER_TOKEN` on `api` (Terraform already wires these; pass emails send via Postmark)
4. Rebuild `api`, `web`, and `event` images
5. Rehearse check-in with **Dry-run on** before door opens
