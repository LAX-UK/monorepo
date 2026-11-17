Verdict: SHIP

Independent review of #1507 (lax.art: favourites tabs get their own loading boundary), head `5d6d5c32`.

## What I checked

**Root cause, from Next 15.5.9 source (the version the app pins).**
- `next/dist/client/components/layout-router.js:405-500`: `OuterLayoutRouter` renders one `LoadingBoundary` per child segment. It takes the loading module from `parentCacheNode.loading` and keys the boundary by the child segment's `stateKey`.
- So `app/account/loading.tsx` is the Suspense boundary for the `favourites` child of `account`, keyed `favourites`. A Saves ↔ Follows switch (`favourites/__PAGE__` ↔ `favourites/follows`) never changes that key. The transition re-suspends inside a boundary that is already on screen, so React holds the old UI and waits instead of committing a fallback.
- `layout-router.js:277-312`: when a segment's `rsc` is missing, the layout router fetches with a `refetch` marker, dispatches `ACTION_SERVER_PATCH`, then calls `use(unresolvedThenable)`.
- `server-patch-reducer.js:40-42`: the reducer returns `state` unchanged when the patch doesn't match the current tree.
- Together these match the PR's account of a transition parked with nothing left to wake it. With `favourites/loading.tsx`, the boundary is keyed by `__PAGE__` vs `follows`, so each tab mounts a fresh boundary and the transition can commit, showing the fallback first.

**Local reproduction on the CI browser-gate stack.**
- Setup: Postgres 16 and Redis, with the env from `art-e2e-pr.yml`. Ran migrate, `db:seed:dev`, `db:roles`, `db:configure-oidc-clients`, `seed:catalogue` and `seed:editorial-showcase`, then production builds of auth-app, shop-identity, shop-api and art.
- Harness: Pixel 7 emulation, signed in. Each attempt loads `/account/favourites` with `waitUntil: "commit"` and taps the tab as soon as it is visible. It then requires both the URL change and the destination tab's `aria-current="page"`. That attribute is rendered by the destination page itself (`art-account-shell.tsx:59-64`), so it proves the new tab's content committed.

| Build | Saves → Follows stuck | Follows → Saves stuck |
|---|---|---|
| PR head without `favourites/loading.tsx` | **8 / 120**. Each stuck tap stayed on `/account/favourites` for the full 20 s wait. | 0 / 30 |
| PR head (with fix) | **0 / 160** | **0 / 70** |

The bug is real and affects the product: a user who taps during hydration gets a dead tap that doesn't recover. The fix removes it. In my runs the URL never changed while the content stayed on a skeleton.

**Tests.**
- `account-tab-boundaries.test.ts` passes on the PR. With `favourites/loading.tsx` deleted it fails (`account/favourites: expected false to be true`). It is deterministic, so it fails without the fix.
- The e2e change only adds an assertion, Follows `aria-current="page"`, which makes the test stricter. The net diff against main has no retry loop, and the original assertion is unchanged.
- `favourites tabs are signed-in routes` passed on both projects on the fix build. The full art suite was 121 passed / 1 failed, and that failure came from my test setup, not the PR. My harness made about 400 sign-ins against the local stack, which tripped LAX Account's "Too many attempts" limiter. That one failure, and the other sign-in timeouts in earlier local runs, are that limiter: the error context shows the "Too many attempts" page. After the auth services were restarted, the favourites and saved-favourites tests passed on both projects. CI's four consecutive green attempts on `5d6d5c32` cover the full suite cleanly.

**Regressions, budgets, design.**
- The change is limited to `app/account/favourites/`.
  - `/account` ↔ `/account/enquiries` still sit under `account/loading.tsx`, keyed per tab, which is unchanged.
  - The favourites pages read no `searchParams`, so `query-navigation-routes.test.ts`'s rule (no loading boundary above routes that change their own query string) is not affected.
  - Other sub-nav tab sets have no loading boundary above them: `/stories/*` has none, and collector-hub has one per leaf. So they don't fall into this pattern.
- Route JS is unchanged: `next build` reports `/account/favourites` at 2.27 kB / 436 kB and `/account/favourites/follows` at 2.24 kB / 436 kB, both with and without the fix. `loading.tsx` and `Skeleton` are server components.
- No changes to `budgets.json`, `lighthouserc.json`, baselines or allowances.
- Screenshots are included for 375 px light and dark: before, after and skeleton. The skeleton follows the real page's layout (centred title band, two tabs, then the grid) and uses only existing skeleton parts. No restyling.
- No AI footer or trailers in the PR body or the 7 commits.

## Findings (none blocking)

1. **The new loading-boundary rule isn't written down where the existing one is.** `docs/ui/art-figma-inventory.md:32` (decision 9) and `:359` record the "no `loading.tsx` above query-navigated routes" rule. This PR adds the counterpart rule for path tabs, but only in a test comment.
   - Fix: add a sentence to decision 9, e.g. "Sibling tab routes (account, favourites) need their `loading.tsx` in the tabs' common parent folder, so each tab mounts a fresh boundary; enforced by `apps/art/src/lib/routing/account-tab-boundaries.test.ts`."

2. **The guard only covers the two tab sets known today.** `apps/art/src/lib/routing/account-tab-boundaries.test.ts:38-41` hard-codes `buildArtAccountTabs` and `buildArtFavouritesTabs`. If a future path-based sub-nav sits under an ancestor `loading.tsx` without its own boundary, it will hit the same bug unguarded. One example would be the `/stories` tabs if a `stories/loading.tsx` or root `loading.tsx` is ever added.
   - Fix (optional, follow-up is fine): state the rule more generally. If any ancestor of a tab set's common parent has a `loading.tsx`, the common parent must have one too. Run it over every tab builder that feeds `MarketingSubNav`, adding the stories tabs to the list.

3. **On Follows, the skeleton's content block doesn't match the page.** `apps/art/src/components/layout/art-route-skeletons.tsx:137` always draws `ArtCardGridSkeleton`, but Follows renders a "Followed artists" heading and an artist list (`ArtFollowedArtistList`). Neither skeleton draws the section heading or the hairline under the tabs. The result is a small layout jump when Follows streams in.
   - Fix (optional polish): have `ArtFavouritesSkeleton` add an `h-8 w-56` heading placeholder before the grid. If it's worth keeping separate per tab, pass a `variant` from a `follows/loading.tsx` to draw list rows. This doesn't block the PR: the shape is already much closer than the `ArtAccountSkeleton` avatar band it replaces.

4. **Expected behaviour change, worth knowing.** Each Saves ↔ Follows switch now briefly shows the full-page skeleton, including the title and tabs, instead of keeping the old tab dimmed until the new one is ready. This is because the title band and tabs are rendered by each page, not by a layout. It matches how `/account` ↔ `/account/enquiries` already behave under `account/loading.tsx`, so the pattern is established. Moving the shell into a `favourites/layout.tsx` would need a client `usePathname` for the active tab and would grow route JS, so I would not do that here.
