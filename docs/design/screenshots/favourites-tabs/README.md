# lax.art favourites tabs: a tap while the page hydrates

Playwright screenshots at 375 px wide (Pixel-style mobile emulation, device scale 2), light and
dark, from production builds on a local seeded stack (the CI browser-gate stack). The buyer is
signed in on `/account/favourites` and taps Follows as soon as the tab is on screen, while the page
is still hydrating. Files are named `{state}-375-{theme}.png`.

- `before-375-*`: without `app/account/favourites/loading.tsx`. Follows was tapped, but the page
  still shows Saves and the URL stays `/account/favourites`; the navigation never commits.
- `after-375-*`: with the boundary. The same tap lands on Follows.
- `skeleton-375-*`: the new favourites loading state, shown while a tab's page streams in (here
  held on screen by delaying the response).
