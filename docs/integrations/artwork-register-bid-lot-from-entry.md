# Creating a LAX Bid lot from a register entry

Status: design note, not built. Gap found while reviewing what the artwork register PRs left uncovered.

## What staff want

Staff creating a lot in LAX Bid admin can start from an existing register entry. Title, artist,
medium, size, images and stock code are pre-filled, and the lot is linked to the entry so the entry's
offer state follows the lot.

## What exists

- **Link column.** `lot.artwork_register_id` (migration 0294, `packages/db/src/schema/lots.ts`),
  nullable, with a partial unique index so one open lot (draft, scheduled, active) per entry
  (`lot_artwork_register_open_uid`). No migration is needed.
- **Staying in step.** Publishing a linked lot offers the entry as `bid_sale`
  (`apps/api/src/services/offer-lock-lot-lifecycle-recording.service.ts`). Unpublish, cancel, void, end
  unsold and payment are recorded by the worker (`apps/worker/src/projectors/artwork-offer-lock.ts`).
  Any lot with a link therefore stays in step with no further work.
- **A draft lot from a register entry, driven from lax.art.** `AuctionDraftLotService`
  (`apps/api/src/services/inventory/auction-draft-lot.service.ts`) creates the draft through the lot
  service with `artworkRegisterId` set, refuses sold, private-sale and Zoho-reserved entries, and is
  reached by LAX Admin's "Offer at auction" over `/internal/inventory/draft-lot` (machine auth).
  LAX Shop builds the content (`ShopOriginalMoveService.contentOf`), including image URLs.
- **Create form.** `/admin/lots/new` (`apps/web/src/lib/admin/lots/load-lot-create-page.ts`) can
  start from `?fromLot=` (clone) or `?saleId=`. It has no register entry point.

## What is missing

1. **A staff read of a register entry in `apps/api`.** `IArtworkRegisterReader` has `findById`,
   `findByStockCode` and `findByZohoProductId`; there is no text search and no admin route. The
   register queue reader (`drizzle-artwork-register-queue.reader.ts`) is used by LAX Admin only.
2. **Image URLs.** The register stores storage keys (`imageRefs`). Shop resolves them to public URLs
   (`resolveImageUrl`); LAX Bid has no resolver and no rule for which bucket and CDN those keys use,
   so the pre-filled lot cannot show pictures yet.
3. **Accepting the link on the staff create path.** `CreateLotInput.artworkRegisterId` is documented
   as "set only by the move from lax.art; never taken from a request body", and the admin lot
   validator (`packages/validators/src/lot/create-update.ts`) does not accept it. Letting staff set it
   is a deliberate change to that rule.
4. **A picker UI.** There is no register search or entry picker in the Bid admin.
5. **Stock code on the lot.** The lot has no stock-code field. It can be shown from the linked entry
   rather than copied.

## Recommended approach

1. Add `GET /admin/artwork-register/:id` (and `?q=` search by stock code or title, originals only,
   not sold) in `apps/api`, behind `requireLotWorkRead`, returning a `LotPrefill` view built by a new
   `RegisterLotPrefillService` next to `AuctionDraftLotService`. Reuse `offerRefusalReason` so a sold,
   private-sale or Zoho-reserved entry is refused with the same wording as the draft-lot path.
2. Decide the image rule, then resolve keys to URLs in that service. Either share the storage
   public-URL helper with Shop through a package, or add a Bid-side config for the public base. Do
   not call Shop at form-open time.
3. Add a separate `registerEntryId` field to the admin create action. The API validates it through
   the prefill service and sets `artworkRegisterId` itself after refusing sold, offered-elsewhere and
   already-linked entries. The unique open-lot index remains the last guard; map its error as
   `AuctionDraftLotService` does (`isOpenLotConflict`).
4. In the web app add `?fromRegister=<id>` to `loadAdminLotCreatePage` (same pattern as `fromLot`), a
   picker on the create page, and a read-only "Linked to <stock code>" row on the lot detail.
5. Tests: prefill service (refusals, content, images), create path (link set only via the new field),
   and one worker-level check that a linked lot published from the form moves the entry to `bid_sale`.

## Files

`apps/api/src/services/inventory/` (new prefill service), `apps/api/src/routes/admin/` (new route),
`packages/validators/src/lot/create-update.ts` and `packages/types/src/lot.ts` (field and comment),
`apps/web/src/lib/admin/lots/load-lot-create-page.ts`, `apps/web/src/components/admin/lot-form/`,
`apps/web/src/lib/forms/schemas/admin-lot-form.ts`.

## Decisions needed

- Where image keys resolve to URLs for LAX Bid.
- Whether staff may link a lot to an entry whose Zoho status is Reserved (the draft-lot path refuses a
  new lot; recommended: refuse here too).
