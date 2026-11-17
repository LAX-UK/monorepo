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
