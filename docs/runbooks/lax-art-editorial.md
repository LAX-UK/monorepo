# lax.art editorial runbook

Operational notes for **Shop Admin → Editorial (lax.art)** and public editorial routes on `shop-api`.

## Flags

| Variable | Service | Purpose |
|----------|---------|---------|
| `SHOP_EDITORIAL_ENABLED` | shop-api | Public `/v1/editorial/*`, admin editorial CRUD, general enquiries |
| `SHOP_EDITORIAL_PREVIEW_SECRET` | shop-api | Signs 15-minute draft preview tokens (≥ 32 chars; rotate to revoke all live links). Required whenever `NODE_ENV=production` (test and prod) and editorial is enabled — shop-api refuses to boot without it |
| `SHOP_MEDIA_PUBLIC_BASE_URL` | shop-api | Public origin for uploaded media; editorial media keys are resolved to absolute URLs on public reads |
| `ART_EDITORIAL_ENABLED` | apps/art | BFF reads against shop-api editorial endpoints |
| `SHOP_IMAGE_REMOTE_HOSTS` | apps/art | Must include the media CDN host so `next/image` can optimise editorial and catalogue media |
| `LAX_ART_PUBLIC_URL` | shop-admin | Builds the full lax.art preview link; without it staff only get the raw token to copy |
| `SHOP_ENQUIRY_NOTIFICATION_EMAIL` | shop-api | Staff inbox for enquiry alerts: artwork enquiries (subject says "LAX Art" or "Shop" by sales channel) and lax.art general enquiries ("New LAX Art enquiry: <topic>"). Alerts are queued in the outbox inside the enquiry transaction; unset means no alert |

Set matching GitHub environment variables on test (`vars.SHOP_EDITORIAL_ENABLED`, `vars.ART_EDITORIAL_ENABLED`) before enabling placements in production.

## Release order (0214–0216 + editorial)

The 0215 catalogue fields (`images`, `objectType`, `rarity`, `dimensionsCmDisplay`, provenance, artist `heroUrl`/`nationality`/…) are **optional** in `@auction/shop-contracts`, so storefronts built from this release still parse responses from an older shop-api. Deploy in this order:

1. **Database** — apply migrations `0214_shop_media_asset`, `0215_shop_catalogue_rich`, `0216_shop_editorial` (each has a `_rollback.sql`).
   Then re-run `configure-oidc-clients` so the lax-art-web client accepts the new `/signed-out` post-logout URLs, and set art-identity `OIDC_POST_LOGOUT_REDIRECT_URI` to `https://<art-host>/signed-out`.
2. **shop-identity** — adds the `GET`/`POST /commerce/me/general-enquiries` proxies to shop-api `/v1/me/general-enquiries` (POST requires `shop.write` + CSRF). Deploy together with shop-api: the old Art build has no enquiry form, so there is no compatibility window to cover.
3. **shop-api** with `SHOP_EDITORIAL_ENABLED=false` — new catalogue fields, artist `letter`/`sort`/`salesChannel`, artwork `objectType`/`rarity`/`relatedTo`, media upload routes.
4. **shop, shop-admin, art** — storefronts tolerate both old and new shop-api payloads.
5. Seed or author content in shop-admin, then flip `SHOP_EDITORIAL_ENABLED=true` and `ART_EDITORIAL_ENABLED=true`.

Rollback is the reverse: disable the two editorial flags first (Art pages fall back to their “coming soon” states), then roll back services, then migrations.

## Home and hub curation

- Editorial slots (`home_hero`, `home_whats_on`, `home_stories`, `home_guide`, `art_hub_spotlight`, `collector_hub_card`) are managed under **Editorial → Placements** in shop-admin.
- “Featured originals” and “Featured artists” on the Art home reuse Shop’s home curation filtered to the Art channel. When that curation holds no Art items, Art shows the newest Art originals and artists instead.
- Slug conflicts on save return 409 and shop-admin says the slug is taken.
- `featured_artists` is one slot shared by Shop and Art (8 positions, filtered by channel at read time); Art's featured strip on `/artists` reads the same slot.
- `/exhibitions` features current then upcoming shows (up to 6) above the status tabs.

## Page routes

Editorial **pages** are served on canonical routes by slug; any other route for the same slug permanently redirects there.

| Page slug | Route |
|-----------|-------|
| `how-to-buy`, `how-to-sell` | `/how-to-buy`, `/how-to-sell` |
| `101-guide` | `/collector-hub/101-guide` |
| `privacy`, `cookies`, `terms`, `accessibility`, `returns`, `shipping` | `/legal/<slug>` |
| anything else | `/collector-hub/<slug>` (with an art-advisory enquiry form) |

Venues live at `/visit/<slug>` and are listed on `/visit`. Placements that point at a page or venue link to these routes. Unknown slugs, and every slug route while `ART_EDITORIAL_ENABLED` is off, return 404.

## Content rules enforced by the API

- Bodies are a typed block list (`packages/shop-contracts/src/editorial-blocks.ts`); there is no HTML block.
- Links (`richText` spans, `cta.href`, `cardGrid[].linkUrl`, placement `linkUrl`) must start with `https://`, `mailto:` or a single leading `/`. `javascript:`, `data:`, `http:` and protocol-relative `//host` URLs are rejected with 400. Art re-checks every link at render time.
- `video.url`, story `videoUrl` and venue `mapUrl` must be `https://`. Films render as a poster that opens the host in a new tab; no third-party iframe is embedded.
- Artwork / artist rails reference catalogue slugs; Art resolves at most 24 distinct slugs per page and silently skips unknown or unpublished works.
- A stored block that no longer passes validation is dropped individually at read time instead of blanking the page.
- Venue `openingHours` is JSON. Prefer a list, which keeps its order: `[{ "label": "Tue – Sat", "hours": "10:00 – 18:00" }, { "label": "Mon", "hours": "Closed" }]`. A map (`{ "Tue – Sat": "10:00 – 18:00" }`) also works, but Postgres `jsonb` does not keep key order, so Art re-orders map rows by their first weekday. Exhibition `timesNote` overrides venue hours on the exhibition page.

## Caching and preview

- Published editorial reads are cached by Art for 120 seconds (`art:editorial` tag); publishes appear within two minutes.
- Draft previews (`/preview/<token>`) are fetched with `no-store`, are `noindex`, and expire 15 minutes after issue.

## Local seed

```bash
DATABASE_URL=... DATABASE_URL_SHOP=... SHOP_EDITORIAL_ENABLED=true \
  pnpm --filter @auction/shop-api seed:editorial-showcase
```

Idempotently publishes, when editorial tables exist (migration `0216`):

- one venue (LAX Marylebone), three exhibitions (current + upcoming featured, one past), a story and a guide;
- pages `how-to-buy`, `how-to-sell`, `101-guide`, `art-advisory`, and **placeholder** `privacy` / `terms` that must be replaced in shop-admin before launch;
- placements for the home hero, what's on, stories, guide, Art Hub spotlight and Collector Hub cards.

`seed:catalogue` adds eight Art-channel originals across painting, works on paper, sculpture, photography and print (with specs, provenance and exhibition history) and three Art featured artists at `featured_artists` positions 3–5.

Seed images are root-relative `/art/seed/*` files served from `apps/art/public`. They resolve only while object storage is off (local and CI); on environments with `SHOP_MEDIA_PUBLIC_BASE_URL`, upload real media in shop-admin instead.

## Staff workflows

1. Catalogue editors manage venues, exhibitions, stories, pages, and placements in **shop-admin** (`/editorial`).
2. Ops readers review **General enquiries** at `/general-enquiries` (admin API `GET /admin/v1/general-enquiries`).
3. Collectors submit general enquiries from lax.art `/contact`, `/visit` and `/visit/<slug>` (private viewing), exhibition pages, `/how-to-sell` (selling) and Collector Hub pages (art advisory). They are stored in `shop_general_enquiry` with `contextSlug`, alert `SHOP_ENQUIRY_NOTIFICATION_EMAIL` when set, and appear for the collector under **Account → Inquiries**.

## Related docs

- [lax-art-production-launch.md](./lax-art-production-launch.md)
- [13-lax-art-and-collector-portfolio.md](../architecture/13-lax-art-and-collector-portfolio.md)
