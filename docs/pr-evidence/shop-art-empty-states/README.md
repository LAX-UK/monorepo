# Shop and lax.art: shared empty states

Screenshots of every changed state, before (`__before`) and after (`__after`), at 1440 and 375 px,
light and dark. File names are `<app>__<state>__<width>__<theme>__<before|after>.png`.

The states are the real wrapper components (`ShopStatusState`, `ShopCatalogueState`,
`CatalogueEmpty`, `CatalogueNoMatch`, `ShopCatalogueEmpty`, `ArtworkDetailState`,
`ArtStatusState`, `ArtAccountListStateView`) rendered to static HTML with each app's production CSS
from the matching build (before = `main`, after = this branch).

## Route JS (CI budget script, `--all` run against local builds with the CI placeholder DSNs)

Before (main):
```
Route JS (gzip, start-up scripts; sizes in KB of 1024 bytes)
app        group     routes  largest   frame     page     duplicates   budget  mode  status  largest route
---------  --------  ------  --------  --------  -------  -----------  ------  ----  ------  -----------------------------------------------
apps/shop  account   16      520.3 KB  514.5 KB  5.8 KB   20 (5.1 KB)  571 KB  warn  ok      /account/orders/[orderId]/report-a-problem/page
apps/shop  checkout  4       551.7 KB  511.2 KB  40.5 KB  7 (4.8 KB)   605 KB  warn  ok      /checkout/page
apps/shop  product   2       552.8 KB  515.3 KB  37.5 KB  9 (6.2 KB)   606 KB  warn  ok      /artworks/[slug]/page
apps/shop  public    17      520.4 KB  510.0 KB  10.4 KB  5 (4.1 KB)   571 KB  warn  ok      /artworks/(hub)/page
apps/art   account   10      522.1 KB  519.7 KB  2.4 KB   7 (3.0 KB)   573 KB  warn  ok      /account/favourites/page
apps/art   product   2       524.0 KB  516.6 KB  7.4 KB   5 (3.5 KB)   575 KB  warn  ok      /artworks/[slug]/page
apps/art   public    31      527.7 KB  516.6 KB  11.0 KB  4 (2.7 KB)   579 KB  warn  ok      /for-artists/apply/page

```
After:
```
Route JS (gzip, start-up scripts; sizes in KB of 1024 bytes)
app        group     routes  largest   frame     page     duplicates    budget  mode  status  largest route
---------  --------  ------  --------  --------  -------  ------------  ------  ----  ------  -----------------------------------------------
apps/shop  account   16      518.5 KB  513.1 KB  5.4 KB   7 (4.8 KB)    571 KB  warn  ok      /account/orders/[orderId]/report-a-problem/page
apps/shop  checkout  4       550.1 KB  510.8 KB  39.4 KB  7 (3.8 KB)    605 KB  warn  ok      /checkout/page
apps/shop  product   2       557.7 KB  520.2 KB  37.5 KB  18 (11.3 KB)  606 KB  warn  ok      /artworks/[slug]/page
apps/shop  public    17      524.1 KB  514.1 KB  10.0 KB  11 (7.8 KB)   571 KB  warn  ok      /artworks/(hub)/page
apps/art   account   10      523.5 KB  521.1 KB  2.4 KB   11 (5.4 KB)   573 KB  warn  ok      /account/favourites/page
apps/art   product   2       525.4 KB  518.1 KB  7.4 KB   9 (6.0 KB)    575 KB  warn  ok      /artworks/[slug]/page
apps/art   public    31      529.1 KB  518.1 KB  11.0 KB  8 (5.2 KB)    579 KB  warn  ok      /for-artists/apply/page

```

## After review

Screenshots of the real pages from production builds (`next start`, local stack), at 1440 and
375 px, light and dark, named `<app>__<state>__<width>__<theme>__after-review.png`:

- `shop__basket-empty`: `/basket` as a guest. One h1 ("Basket"); the state's title is an h2.
- `shop__detail-not-found`: `/artists/does-not-exist`. The "Not found" eyebrow sits directly
  above the h1 in the copy column.
- `art__favourites-empty`: `/account/favourites` signed in with no saves.
- `art__apply-signed-out`: `/for-artists/apply` signed out. One h1 ("Apply to join"); the state's
  title is an h2; at 375 px the two actions stack full width.

Every page had exactly one h1 and no horizontal overflow at 375 px.

### Route JS after review

Local production builds with the CI placeholder DSNs, `node scripts/check-route-js-budget.mjs --all`,
compared route by route with a local build of main at `aef61e26` (which matched main's CI table,
run 43810475714, to within 0.1 KB). No route of Shop (39), lax.art (43) or Bid (114) is larger
than main: Shop −0.5 to −3.7 KB, lax.art −0.7 to −0.8 KB, Bid −0.1 to 0.0 KB.

```
app        group     routes  largest   frame     page      duplicates     budget
apps/shop  account   16      517.1 KB  512.1 KB  5.0 KB    9 (3.5 KB)     571 KB  warn
apps/shop  checkout  4       548.8 KB  509.8 KB  39.0 KB   9 (2.5 KB)     605 KB  warn
apps/shop  product   2       550.0 KB  512.5 KB  37.5 KB   9 (3.9 KB)     606 KB  warn
apps/shop  public    17      518.1 KB  508.5 KB  9.6 KB    7 (2.1 KB)     571 KB  warn
apps/art   account   10      521.3 KB  518.9 KB  2.4 KB    6 (2.7 KB)     573 KB  warn
apps/art   product   2       523.3 KB  515.9 KB  7.4 KB    4 (3.3 KB)     575 KB  warn
apps/art   public    31      526.9 KB  515.9 KB  11.0 KB   3 (2.5 KB)     579 KB  warn
apps/web   account   70      545.3 KB  442.7 KB  102.6 KB  133 (33.3 KB)  620 KB  warn
apps/web   checkout  4       471.8 KB  441.1 KB  30.7 KB   94 (22.7 KB)   537 KB  warn
apps/web   listing   11      462.3 KB  337.4 KB  124.9 KB  90 (22.2 KB)   523 KB  enforced
apps/web   lot       3       467.5 KB  343.2 KB  124.3 KB  93 (19.8 KB)   536 KB  enforced
apps/web   public    25      394.6 KB  337.4 KB  57.2 KB   79 (17.3 KB)   448 KB  enforced
apps/web   sale      1       479.0 KB  341.5 KB  137.5 KB  121 (28.8 KB)  556 KB  enforced
```
