# Stock location per artwork (proposed design, awaiting owner approval)

Register item ZI-6. Owner answer Q35 ("STO actions") is not recorded in the repository, and no approved
design defines the location values, the screens or the Zoho field. This note proposes the recommended
option so the owner can approve or change it before anything is built. Nothing here is built yet.

## What exists today

- The artwork register (`artwork_register`, history in `artwork_register_event`) records where an
  artwork is **offered** (Not offered, lax.art, LAX Bid, private sale, Sold, Withdrawn). Its "moves"
  are offer moves (`artwork_register.offer_changed`), not physical moves.
- Zoho Products already carry `LAX_Listing` (+ `_Detail`, `_Link`, `_Updated`), written by the
  `zoho_artwork_listing` projector. It holds the **sales place** ("Where it is" in LAX Admin), not
  where the work physically sits.
- Open-edition stock batches have a free-text `storageLocation` (200 chars). Originals have nothing.

## Recommendation

1. **Controlled list of locations, managed by staff in LAX Admin.** New page LAX Admin › From Zoho ›
   Locations: name (unique, up to 80 chars), optional short note, active/retired. Retire instead of
   delete, so history keeps reading. Seed list is empty; staff add their own (e.g. "Gallery — main
   room", "Store room", "Framer", "On loan"). No free text per artwork, so reports and filters stay
   clean.
2. **Current location derived from the latest move.** Each change is a row in a new append-only
   `artwork_location_move` table (artwork register id, location id, moved at, moved by, optional
   note up to 500 chars). The current location is the latest row; no second copy to drift. An
   artwork with no move reads "Location not recorded".
3. **Screens.** On the artwork's From Zoho record: a "Location" panel with the current location and a
   **Move** action (select location, optional note), and the full move history below (who, when,
   from → to, note). The register list gains a Location column and filter, plus a bulk **Move
   selected** for moving a hang or a shipment in one go. Built with the staff-ui kit, light/dark,
   375 px, with empty, loading, error and retired-location states.
4. **Permissions.** New capabilities: `artwork_location.read` (included in `artwork_register.read`),
   `artwork_location.move` and `artwork_location.manage` for the list (Admin only, recent sign-in).
   Every move and list change writes a LAX Admin audit row and publishes
   `artwork_register.location_changed`. Who holds them is set in the one role table,
   `packages/shop-domain/src/staff-capabilities.ts`; see **Roles** below.
5. **Zoho mirror.** A new read-only Products field **`LAX_Location`** (picklist kept in step with the
   list, or text if the owner prefers not to maintain a picklist in Zoho), written by the existing
   outbound pattern: the writeback projector reads the register's current state on
   `artwork_register.location_changed`, skips the write when Zoho already holds the value, honours
   its own `ZOHO_ARTWORK_LOCATION_MODE` (`off` / `dry_run` / `live`) and the wrong-org guard (built:
   [Zoho integration](../integrations/zoho.md#stock-location-to-zoho-products-outbound)), and is rolled
   out sandbox `dry_run` → sandbox `live` → production. Zoho stays read-only for this field; a value
   edited in Zoho is overwritten by LAX on the next change and reported in Sync health drift.
   `LAX_Listing` is **not** reused: it already means the sales place, and mixing the two would make
   both unreliable.
6. **Migration.** One additive migration (two new tables, one event type, role grants) with a
   rollback file and a test, numbered after main's last journal entry at build time.
7. **Out of scope for now:** locations for prints/edition stock (they keep their free-text field),
   barcode scanning, and automatic moves from shipping or collections. These can follow later.

## Roles (decided 17 Nov 2026)

The owner decided that the people responsible for the catalogue move artworks. The first build
gave `artwork_location.move` to account managers ("Gallery staff") and operations ("Fulfilment");
it now sits with the Catalogue editor instead.

| LAX Admin role | Sees locations | Moves artworks (`artwork_location.move`) | Keeps the list (`artwork_location.manage`) |
| --- | --- | --- | --- |
| Administrator (`shop_admin`) | Yes | Yes | Yes |
| Catalogue editor (`catalogue_editor`) | Yes, with the From Zoho register | Yes | No |
| Read-only (`read_only`) | Yes, with the From Zoho register | No | No |
| Account manager, Operations, Broker, Finance, Editor | No | No | No |

- The Catalogue editor holds `artwork_register.read` (the From Zoho record and All artworks list,
  where Move and Move selected sit) beside the move, so the move is always reachable.
- shop-api refuses `POST /admin/v1/artwork-location-moves` with a 403 for every role without the
  capability; LAX Admin hides Move and the row selection for them. Both read the same table.
- Roles are a code table, not database rows, so the change needed no migration.

## Questions for the owner

- Q35 / ZI-6: approve the controlled list + move history above, or say what "STO actions" should
  cover (for example, a fixed set of stores rather than a staff-managed list).
- Zoho: a new `LAX_Location` field (recommended) or a different existing Products field? Picklist or
  text?
- ~~Who may move artworks: Fulfilment, Gallery staff and Admin as proposed?~~ Decided 17 Nov 2026:
  Catalogue editors and Administrators (see **Roles**).
