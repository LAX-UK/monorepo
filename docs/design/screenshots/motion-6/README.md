# Motion PR 6: first screen

Playwright screenshots of the first screen (viewport only) at 1440 and 375 px wide, light and
dark, from production builds of main (`6f49e6ed`) and this branch on a local seeded stack (the CI
browser-gate stack: migrate, `db:seed:dev`, Shop `seed:catalogue` and `seed:editorial-showcase`).
Remote image hosts are blocked in the sandbox, so remote pictures were served one stand-in image
on both sides; the lax.art hero and Bid's sign-in page use local images. Files are named
`{page}-{width}-{theme}.png`.

Pages: `shop-home` (Shop home, the cover), `shop-print` (a Shop print page), `art-home`
(lax.art home, the hero) and `bid-sign-in` (Bid's sign-in page in its error state,
`/login?error=access_denied`, drawn by `AuthLayout`).

- `at-rest/`: this branch, once every entrance has finished. Pixel-identical to main (threshold
  24 on summed RGB) on every page, width and theme except lax.art home at 375 px, where 0.82% of
  pixels differ: the "What's on" heading row sits 1px higher. That is the removed permanent
  `will-change` on reveals: the text now snaps to the page's pixel grid instead of its own
  compositor layer's. Putting `will-change: transform` back on `.reveal__inner` on this branch
  reproduces main's picture exactly.
- `first-frame-before/` (main) and `first-frame-after/` (this branch): the page after load and
  hydration with every CSS animation and transition held at its first frame (Chrome DevTools
  `Animation.setPlaybackRate(0)`), so each shows what the first paint of an entrance looks like.
  On main the Shop print's work (priority image), the lax.art hero (photograph and panel) and the
  sign-in panel's content are blank; on this branch each is drawn. Shop home is not included: its
  cover was already drawn on main's first frame and is unchanged.


## Clips (`clips/`)

Short webm recordings of the moving states (MO14 "Looks"), a few seconds each, recorded with
Playwright video at 1440 or 375 px wide. They are **not** recorded from the live routes: the
lax.art home and Shop grids need the seeded API stack, which was not available when these were
made. Each clip loads a minimal page that uses this branch's compiled lax.art stylesheet
(`apps/art/.next/static/css`, production build) and the real class names and markup of the
components: the hero panel and drift classes from `ArtHomeHero`, and `.lax-image-fade`,
`.lax-card` and `.lax-card-media` with the `opacity-100` on load that `MediaImage` adds. The
pictures are generated placeholders (served with a 900ms delay so the fade can be seen), and the
hero is the section and panel only, without the header.

- `art-home-hero-1440.webm`, `art-home-hero-375.webm`: the hero panel is drawn from the first
  frame and settles up 1rem over lax.art's `--art-hero-panel-duration` (900ms); the photograph
  drifts.
- `lazy-fade-grid-1440.webm`: a grid far below the fold is scrolled into view; each lazy picture
  fades in over 200ms once it has loaded.
- `lazy-fade-in-hovered-card-1440.webm`: the pointer is over a card while its lazy picture loads,
  so the zoom and the fade run together.
- `reduced-motion-hero-and-lazy-fade-1440.webm`: `prefers-reduced-motion: reduce`. The hero panel
  and drift do not move; the lazy picture fades over 120ms.
