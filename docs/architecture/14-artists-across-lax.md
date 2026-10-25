# Artists across LAX

**Status:** planning. Nothing in this document is built yet. One direction is agreed in principle (a staff-confirmed link). The other questions are open and will be decided later.

## Why this matters

LAX Bid, LAX Shop and lax.art all show artists, but the word means something different in each business.

- **LAX Bid**, run by London Auction Xchange LTD, lists artists as creators of lots that are consigned and sold at auction. One record can cover a single artist, a studio or an estate (`kind`). Records can be historical, and staff review, verify, alias and merge them.
- **LAX Shop and lax.art**, run by London Art Exchange Ltd, list the gallery's represented artists: their originals, editions, exhibitions and stories. An artist may also be a seller or payee, and a record can be linked to the artist's own login.

Any plan must respect this difference. A Bid artist and a gallery artist with the same name are not automatically the same record or the same relationship.

## Current state

| | LAX Bid | LAX Shop and lax.art |
|---|---|---|
| Record | `artist_profile`, with `artist_alias` and `artist_categories` | `shop_artist`, shared by Shop and lax.art |
| Notable fields | kind, status and review, verified, featured, aliases, `merged_into_artist_id`, owner user | party, Zoho artist code, identity subject (the artist's login), short and long bio, discipline |
| Follow | `artist_watchlist` ("Watch artist") | `shop_followed_artist` ("Follow artist") |
| Managed in | Bid admin | LAX Admin |
| Link between the two | None | None |

Because there is no link, the products cannot reliably point to each other for the same artist. Cross-product links must never guess a match from a name or slug.

## Direction agreed in principle: a staff-confirmed link

- Keep both records. They belong to different companies and serve different purposes.
- Add an explicit link between a Bid `artist_profile` and a `shop_artist`, created only when staff confirm it.
- LAX Admin gets a matching queue. It suggests likely pairs from name, aliases, slug and birth year, and staff confirm or reject each pair. Rejections are remembered so the same pair isn't suggested again.
- Each admin shows the linked record from the other product, read-only.
- Every cross-product feature below depends on a confirmed link.

**Not scheduled yet.** Before building:
- define the link table and who can write it;
- define what happens when either side is merged or archived;
- define the audit trail.

## Open decisions

1. **Following an artist.**
   - Option A: one "Following" list in LAX Account. Following anywhere follows across products, and the person chooses alerts per product (new lot or upcoming sale on Bid, new edition or restock on Shop, new original or exhibition on lax.art). The existing watch and follow lists would be merged.
   - Option B: keep separate follows per product.
   - Option A needs the confirmed link and a notification preference model.
2. **Main biography.**
   - Option A: lax.art holds the full biography. Bid shows its own catalogue note and links to lax.art, and Shop shows none.
   - Option B: each product keeps its own text.
   - Business-team copy is never rewritten automatically.
3. **Cross-product links on artist pages.** Which links appear ("Originals at lax.art", "Editions in LAX Shop", "At auction on LAX Bid") and in which direction, given the different meaning of "artist" in each business. Shop and lax.art can already link to each other because they share one record.
4. **Artists as users.** Whether an artist's LAX Account Selling area should also show Bid consignments and results for their linked Bid record, or Shop and lax.art only.
5. **CRM.** Whether Zoho should receive one artist identity or one per company.
6. **Search engines.** The canonical page per artist when they appear in more than one product.

## Related work

- **In progress:** one shared design for the artist pages across Bid, Shop and lax.art (directory with a filter rail on desktop and a sheet on mobile, hero, facts, works grid, states). This is design only, with no data linking.
- **Already live:** the Shop product page shows "Editions by {artist}" and "About the artist on lax.art" through the shared Shop and lax.art record.
