# lax.art home: prerendered HTML

First-viewport screenshots of `/` on the seeded CI browser-gate stack (shop-api with the catalogue
and editorial showcase seeds), reduced motion, device scale 1. Remote image hosts were blocked;
the pictures are the seed's local images.

- `head-js-on-*`: this change with JavaScript on. Full-page screenshots of main and this change
  with JavaScript on were pixel-identical (0 differing pixels) at 1440 and 375, light and dark,
  signed out.
- `head-js-off-*`: this change with JavaScript off. The HTML carries the hero and every section.
  `head-js-off-375-light-full-page.png` shows the whole page.
- `main-js-off-*`: main with JavaScript off, for comparison: the route loading screen.

Dark with JavaScript off draws the light theme on main and here alike: the theme is set by a
script before first paint. With JavaScript off, a lazy picture still shows the `MediaImage`
hatched placeholder (the separate follow-up from #1502).

## Signed in, while the browser reads the visitor

`signed-in-*`: a signed-in visitor, with `/api/viewer` held open (`pending`) and then answered
(`settled`), device scale 2. `home` is the prerendered `/`, `artworks` is `/artworks`, rendered
per request. At 1440 the crop is the header; at 375 it is the phone tab bar.
`signed-in-footer-1440-*` is the footer's Account column.

- While pending, the header account slot, the Account tab's icon and the footer Account list keep
  their place but draw nothing. No guest "Account" control or Sign in link appears first.
- Once settled, the visitor's own control appears in that same place. The header slot is 160 px
  wide from 1024 px for every visitor, so the search, theme and favourites controls do not move.
  A first name that does not fit is cut. A guest's "Account" sits at the slot's right edge.
- `e2e/viewer-chrome-stable.spec.ts` checks this at 1440 and 375 on both pages: the header, slot,
  tab bar and footer list have the same boxes before and after, and the layout-shift entries
  touching them add up to 0.
- Before this fix, on the same build and data at 1440, the guest "Account" control was visible
  while pending, and when the visitor landed the favourites and account controls moved left by 62 px.
