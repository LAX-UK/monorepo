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
