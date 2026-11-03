# Home cover data backfill

The Bid home cover needs measured pictures. It shows a photograph when the sale's default cover
slot is measured and at least 2400 px wide, otherwise the lead lot on a plate when that lot's
photograph has a stored size and a long side of at least 800 px, otherwise type only. This
backfill gives existing sales and lots the data those rules read. Pictures staff upload are
measured automatically; the backfill is for data that was there before (and for seeded demo data
on test).

## What it does

`apps/worker/src/scripts/backfill-cover-data.ts`, run as `backfill:cover-data` in `@auction/worker`.

1. **Sizes and blur previews** for pictures in LAX storage that have no `media_asset` row (lot
   photographs, sale covers, cover slot pictures).
2. **Pictures held as full https addresses** (seeded or imported, never uploaded): lot primary
   photographs and sale cover pictures. Each is fetched, measured (width, height, average
   luminance, blur preview) and its size stored in `media_asset` under the address itself, which
   is what the lot page and the cover already look up.
3. **Named cover slots** (`--materialise-covers`): sales still holding their covers in the old
   array get `default`, `phone` and `wide` slots with a centred focal point (C4). A picture below
   its slot floor is skipped: default 2400 px wide, wide 2880 x 1080, phone 1200 x 1200 (C3).
   A slot staff already set is never touched.
4. **Colours and the text scrim** (C7) for every slot that has none, with the same measuring the
   worker runs minutely.

The script is idempotent: it only visits pictures without a stored size and slots without an
analysis, and a second run reports nothing to do.

A picture held as an address can be measured for a plate, but it cannot become a cover slot:
slots point at LAX storage. A sale whose only cover is an address needs its picture uploaded in
the admin Cover and home tab.

## Running it

The environment is the worker's: `DATABASE_URL` (and `DATABASE_URL_WORKER` outside local
development), and the storage settings for the environment. `--materialise-covers` writes sales
with `DATABASE_URL`, because the worker role cannot write them.

Dry run, the default. It reads pictures and writes nothing:

```bash
pnpm --filter @auction/worker backfill:cover-data -- --materialise-covers
```

Apply, after reading the dry-run report:

```bash
pnpm --filter @auction/worker backfill:cover-data -- --materialise-covers --apply
```

`--limit=N` visits at most N pictures per step, for a first small run.

Run it on test first, check the home page, then on production with the same two commands. Run it
once the admin Cover and home tab is in use, so staff choices and the old array do not drift apart.

## What the dry run reports

JSON, printed once:

- `externalPictures`: per picture its role (`lot-primary` or `sale-cover`), address, width,
  height, average luminance (0 black to 1 white) and verdict, with counts of usable, below floor
  and unreadable pictures, and `skipped` listing each skipped picture with the reason and what it
  needed (`below_plate_floor`, `below_slot_floor`, or `unreadable` with the error).
- `picturesWithoutSize`: pictures in storage still to be sized.
- `legacyPlan`: for each cover still in the old array, whether it would become a slot, is below
  its floor and is skipped, or waits for its size.
- `coverSlotsToAnalyse`: slots waiting for colours and a scrim.

Apply prints `sized`, `sizeFailed`, `externalStored`, `materialised`, `slotsBelowFloor` (each
skipped slot with its size), `analysed` and `failed` (slots whose picture could not be read; staff
see these in the Cover and home tab).

## After applying

Open the Bid home page. A sale with a measured cover shows its photograph. A sale whose lead lot
has a stored size of 800 px or more on its long side shows the plate. Anything else shows type
only; the skipped list says which pictures to replace.

## New data

Nothing needs backfilling again. Uploaded pictures are measured by the process-image job, slots
set in the admin are analysed within a minute, and lot photographs held as https addresses are
measured by the worker on the same minute tick (ten per run; an address that cannot be read is
skipped until the worker restarts, and logged as a warning).

Seeded demo pictures are 1200 px wide. They reach the plate floor but not the 2400 px cover
floor, so the demo shows plates, not photographs.

## Visual baselines

`apps/web/e2e/cover-visual.spec.ts` covers the cover states on fixture data. See
`apps/web/e2e/__snapshots__/README.md` for generating the baselines.
