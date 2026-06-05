# LAX opening-event RSVP (`event.lax.bid`)

Static Vite microsite for the LAX 001 opening invitation. Ops shares `https://event.lax.bid#rsvp` directly.

The microsite uses the generic **onsite events** API (`/events/:slug/*`). Segment options and RSVP close time come from the `onsite_event` registry row (`lax001`).

## Guest flow

1. **Email** — enter lax.bid account email (no password)
2. **Existing client** → attendance form
3. **New guest** → guided to create account, then auto-resume via `?email=` in the return URL
4. **Confirm** → guest receives confirmation email; ops copy to the event's `ops_email`

Any registered lax.bid client can RSVP.

## API (public)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/events/lax001/config` | Title, segment options, RSVP open/closed |
| `POST` | `/events/lax001/lookup` | `{ email }` |
| `POST` | `/events/lax001/rsvp` | `{ email, attendanceSegment, plusOne, plusOneGuestName?, notes? }` |

## Admin (staff)

| Method | Path |
|--------|------|
| `GET` | `/admin/onsite-events` |
| `GET` | `/admin/onsite-events/lax001/rsvps` |
| `GET` | `/admin/onsite-events/lax001/rsvps/export` |

Web UI: `/admin/onsite-events` → select event.

## Local development

```bash
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm --filter @auction/api dev
pnpm --filter @auction/event dev
```

API `.env`: include `http://localhost:3003` in `WEB_ORIGINS` for CORS from the event microsite.
