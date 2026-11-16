Verdict: FIX FIRST

# Review: PR #1502 "Motion system 6/8: first screen"

- Branch `motion-first-screen`, head `e12105e6`, merge base `6f49e6ed` (merges cleanly into main `121004fd`).
- Checked against `docs/design/motion.md`: Principles, "Images", MO13, MO14, MO15, Q3 and build step 6. Compared with the merged motion PRs #1470, #1475, #1476, #1486 and #1485.
- This is a review only. The PR branch was not changed.

File references below are on the PR head unless they say otherwise.

## Blocking

1. **No short recordings of the moving states (MO14 "Looks").** MO14 says: "Short recordings of moving states in the PR." This PR changes three moving states, and the PR has only stills:
   - The lax.art hero panel entrance goes from `opacity 0→1 + translateY` over 650ms `ease-out` to transform only over `--motion-duration-lg` (520ms) on `--motion-ease-emphasize` (`apps/art/src/app/base.css:142-143`, `:162-169`).
   - The `MediaImage` lazy load fade goes from Tailwind's 300ms `cubic-bezier(0.4,0,0.2,1)` to 200ms `--lax-ease-out` (`packages/ui/src/lax/image-fade.css:20-23`).
   - Shop's work-mat fade (240ms on every image, `apps/shop/src/app/state.css` on main) becomes the kit fade on lazy images only, plus the zoom-and-fade composition (`packages/ui/src/lax/hover-press.css:53-56`).

   The `first-frame-before/after` stills prove the first frame is no longer blank, but they do not show the entrance or fade motion. The "Skipped or blocked gates" list names only Lighthouse, so the missing recordings are not disclosed either.

   **Fix:** attach short recordings (a few seconds each) to the PR:
   - lax.art home hero settling at 1440 and 375.
   - A below-the-fold lazy `MediaImage` fading in on a Shop or lax.art grid.
   - The same lazy fade inside a hovered card (zoom and fade together).
   - Ideally one reduced-motion clip showing no movement and a 120ms fade.

   Alternatively, state explicitly in the PR why they are not provided. No code change is needed.

## Non-blocking

1. **The hero entrance is now faster than before, not slower (Q3 wording).** Q3 says lax.art "keeps its slower editorial reveals". The panel goes from 650ms to 520ms (`apps/art/src/app/base.css:142`; `--motion-duration-lg: 520ms` at `:193`). That token is also 520ms in Shop (`apps/shop/src/app/base.css:217`) and Bid (`apps/web/src/app/globals.css:251`), so it is not lax.art-specific. Aligning the hero with lax.art's own `fade-up` reveal timing is defensible. But the PR edits MO15 itself to bless it (`docs/design/motion.md`, MO15 "Start lax.art's home hero visible ... on lax.art's editorial reveal tokens"). Say in the PR that the entrance is 130ms shorter than main. The recording in blocking 1 will show whether it still reads as editorial.
2. **Route JS: +1 B gzip on 38 Shop and 33 LAX Account entries.**
   - Every code-bearing change is a deletion or a shorter string:
     - The `AuthContentReveal` import is removed (`apps/web/src/components/auth/auth-layout.tsx:28`).
     - `"lax-image-fade"` replaces longer class strings in `packages/marketing-ui/src/media/media-image.tsx:138` and `packages/marketing-ui/src/cover/cover-picture.tsx:9`.
   - So nothing can grow by code. CI `build` passes `check:route-js-budget` (job 133372166532), and no budget, ratchet, baseline or allowlist file is in the diff. The 1 KB tolerance is not relied on.
   - The PR attributes the +1 B to the Sentry release SHA, which was not pinned. #1485 set the bar by pinning `SENTRY_RELEASE` (or normalising debug IDs) and showing literally "0 higher". Doing the same here would close it.
3. **Lazy cover slides still blink once, off-screen.** `useImageLoad` starts in phase `ssr` (`cover-picture.tsx:20`). That keeps `opacity-100` in the server HTML, so JS-off is fine. On hydration, an incomplete lazy picture moves to `loading` (`:24`, `:29`), which removes `opacity-100`, and the kit rule hides it until it loads. This only affects non-first slides: slide 0 is `priority && index === 0` (`marketing-cover.tsx:85`), so it is eager and never hidden. These slides are not on the first screen, so this is acceptable. A short comment would help.
4. **Shop basket thumbnails lost their fade and did not get the kit one.** `basket-lines.client.tsx:52` renders a plain `next/image` (lazy by default) inside `.marketing-work-mat`. Before, Shop's removed `.marketing-work-mat img` animation faded it. Now it appears at once because it has no `lax-image-fade` class. That is harmless, and arguably right because basket thumbnails are on the first screen. But it is a lazy image that does not fade, unlike the design's "Images" rule. Either mention it in the PR or leave it as is on purpose.
5. **PR body links are broken.** In "Still screenshots", links are written as ``[text](`` https://… ``)``, with backticks inside the link target. GitHub does not render these as links. Use plain URLs or `![alt](url)`. The files themselves are committed and fine. The body has no AI or generated-by footer.
6. **`MarketingHeroReveal` is now unused.** After this PR it has no importer in any app (`packages/marketing-ui/src/motion/reveal/marketing-reveal.tsx:97-113`). It is a `RevealOnMount fadeUp`, the same hide-on-hydration pattern this PR removes. Consider deleting it in a later PR so it is not reused on a first screen.
7. **Out of scope, noted only:** `apps/event/public/event-page.css:831` keeps `will-change: transform` on an infinite marquee. It is not a reveal, and the event app is not in the motion system's product list.

## Verified

**(1) Shop first-screen images appear at once; lazy images keep the 200ms fade. The code paths are live.**
- `packages/ui/src/lax/image-fade.css:20-23` hides and fades only `.lax-image-fade[loading="lazy"]`. It is in `@layer components`, so the `opacity-100` utility wins.
- `theme.css:21` imports it. That reaches every app: `apps/shop/src/app/base.css:4`, `apps/art/src/app/base.css:4`, `apps/web/src/app/globals.css:4`, `apps/account/src/app/globals.css:4` and `apps/shop-admin`.
- I compiled Shop's real `base.css` with `@tailwindcss/postcss` and confirmed the layer order in the output:
  - `@layer theme, base, components, utilities` comes first.
  - The fade is in `components`, the card-zoom composition is unlayered, and `.opacity-100` is in `utilities`.
  - Shop's old `.marketing-work-mat img` animation is gone. Only its `filter` rule remains.
- Live routes:
  - **Shop print page:** `ShopMediaImage` wraps marketing-ui `MediaImage`. The first slide is `priority={active === 0}` (`apps/shop/src/components/artwork/artwork-gallery.client.tsx:136`). `next/image` priority gives no `loading` attribute, so the image is never hidden.
  - **Shop and Bid home cover:** `home-cover.tsx:37` passes `priority`, and slide 0 is `loading="eager"` (`cover-picture.tsx:119`).
  - **Bid:** `apps/web/src/components/ui/media-image.tsx` re-exports the shared `MediaImage`.
  - The edited components are rendered by routes, not unused.
- Shop has no other image fade: all Shop CSS is in `apps/shop/src/app/*.css`, which `first-screen-images.test.ts` scans, and no `opacity-0` image utilities remain in Shop or lax.art components.
- I opened `first-frame-after/shop-print-375-light.png`: the work is drawn. `at-rest/shop-home-1440-dark.png` shows the cover drawn.

**(2) lax.art home hero is visible in the server HTML and at first paint; drift kept; nothing hidden at rest.**
- `art-hero-panel-in` keyframes are transform only (`apps/art/src/app/base.css:162-169`).
- The panel and drift are `motion-safe:` only (`art-home-hero.tsx:21,32`).
- The drift only scales from 1 to 1.02 (`base.css:171-178`), which keeps Q3.
- The hero photo is a priority `MediaImage` (`art-home-hero.tsx:22-25`), and the route renders `<ArtHomeHero>` (`apps/art/src/app/(home)/page.tsx:196`).
- I opened `first-frame-before/art-home-1440-light.png` (blank black hero) and `first-frame-after/art-home-1440-light.png` (photo, h1, copy and CTA drawn).

**(3) The sign-in blink is gone, checked on the real sign-in layouts.**
- Bid `/login` renders `HostedLoginErrorPanel` → `AuthLayout` only for `?error=`. Otherwise it redirects to hosted auth (`apps/web/src/app/(task)/login/page.tsx:23-37`).
- `AuthLayout` now renders `children` directly (`auth-layout.tsx:28`), and `auth-content-reveal.tsx` is deleted. Its importers are all live routes:
  - activate, set-password
  - onboarding/account
  - invitations accept and welcome
  - verify-email
  - account-suspended
  - unsubscribe
  - hosted login error panel
  - verify-pending-missing-email
- The real hosted sign-in page (`packages/auth/src/hosted-auth/*`, served by `apps/auth/src/container/mount-hosted-auth-pages.ts`) has no entrance animation. Its only transition is the input border at `styles.ts:446`, and its reduced-motion block is at `:943-945`.
- Shop and lax.art `/login` are server redirects. Their `sign-in-error` pages use no reveal.
- No `RevealOnMount` or `MarketingHeroReveal` caller remains in any app.
- I opened `first-frame-before/bid-sign-in-375-dark.png` (empty panel) and `first-frame-after/bid-sign-in-375-dark.png` ("Try again" and "Back to sign-in" drawn).

**(4) `will-change` is set only while animating.**
- `.reveal__inner` no longer sets it (`packages/marketing-ui/src/marketing-ui.css:68-75`).
- `rg will-change` over apps and packages (CSS, TS, TSX, `willChange`) finds nothing else in the motion system's scope.

**(5) Tokens only, compositor-only, no `transition-all`, Lenis untouched, reduced motion per MO13.**
- The new rules use `--lax-motion-enter`, `--lax-motion-fade`, `--lax-ease-out`, `--lax-motion-media`, `--motion-duration-lg` and `--motion-ease-emphasize`. The cover's literal `duration-[240ms]` and MediaImage's literal `duration-300` are removed.
- Only `opacity` and `transform` are animated. No `transition-all` is in the touched files.
- No Lenis file is in the diff.
- Reduced motion (`image-fade.css:31-53`):
  - Public products get 120ms. Staff and LAX Account get 0s.
  - `force-allow` keeps 200ms. `force-reduce` is mirrored.
  - Under reduce, the card zoom's unlayered transition falls back via `revert-layer` (`hover-press.css`) to the layered fade. That keeps the 120ms or 0s value.
  - The hero animations are `motion-safe:` only.
- CI `static-checks` (which runs `lint:compositor`) passed.

**(6) SEO and JS-off parity.**
- The diff changes only class names and CSS, and removes one client wrapper div around unchanged children. No text or `<a href>` is added or removed, which agrees with the PR's server-HTML comparison.
- `@media (scripting: none)` shows lazy images with JavaScript off (`image-fade.css:25-29`). That improves JS-off ≡ JS-on on the Shop print page (the PR measured 0.207 → 0.009).
- No `blocking="render"` and no Speculation Rules are added.

**(7) Route JS.** See non-blocking 2:
- No code-bearing growth.
- CI budget step green.
- No budget or baseline changes.
- Bid `AuthLayout` routes are about −1.2 KB.

**(8) MO14 proof, tests and CI.**
- LCP and CLS were measured with observers, 4x CPU and about slow 4G, median of 5, on identical builds of main and head:
  - Shop print: 5,124 → 1,360 ms.
  - lax.art home: 5,896 → 1,680 ms.
  - CLS is 0 → 0 everywhere.
  - Lighthouse is deferred to the post-deploy workflow, which is disclosed.
- The reduced-motion check and its Chromium cases are present.
- Screenshots at 1440/375, light/dark:
  - They are committed under `docs/design/screenshots/motion-6/`, and I opened six of them.
  - `at-rest/` and `first-frame-after/` are byte-identical for sign-in and print, as expected because those pages have no remaining entrance.
- I ran the PR's tests locally:
  - `image-fade-resolved` and `hover-press-resolved`: 87/87 with `LAX_REQUIRE_CHROMIUM=1`.
  - Shop `first-screen-images`: 2/2.
  - lax.art `home-hero-motion`: 4/4.
  - marketing-ui media, cover and reveal-css: 55/55.
  - Bid `auth-layout` and `media-image`: 9/9.
- My own mutations, each reverted afterwards, were all caught:

  | Mutation | Result |
  |---|---|
  | Main's `state.css` | 1 failed |
  | Main's art `base.css` | 2 failed |
  | Main's `AuthLayout` and `auth-content-reveal` | 1 failed |
  | `will-change` restored | 1 failed |
  | Main's `MediaImage` and `cover-picture` | 4 failed |
  | `[loading="lazy"]` dropped | 24 failed |
  | `scripting: none` block removed | 1 failed |

- CI on head `e12105e6`: all 41 check runs succeeded, including `ci-result`, `build`, `ui-chromium` (now also running `image-fade-resolved`), `static-checks`, `browser-gates`, `art-browser-gates` and `account-browser-gates`.
- The PR body follows the template, with Summary, Proof, Quality review, Test evidence and Follow-ups, and has no AI footer. Apart from the missing recordings, it is complete.

## Final recheck

- Head `9c931137` (two new commits since `e12105e6`: `50062f8c` and `9c931137`). Merge base with main is `121004fd`. Main has since moved to `dd81f7f2` (#1504, Shop help centre). That change does not touch these files.
- I read the PR body as it is now, the CI check runs on `9c931137`, and the diff `e12105e6..9c931137`. I also extracted frames from each committed clip and looked at them.
- Review only. The PR branch was not changed.

### Item by item

| # | Item | Status | Evidence |
|---|---|---|---|
| B1 | Short recordings committed and linked | **Done** | Five webm clips are in `docs/design/screenshots/motion-6/clips/`, and the README there describes them (`README.md:26-50`). See the table below for what each one shows. The PR's "Short recordings" section links each clip, and four of the links work. They are harness pages that use the branch's compiled lax.art CSS and the components' real class names, not the live routes. The PR body (Short recordings and Skipped gates) and the README both say so plainly. For MO14 "Looks" that is acceptable. |
| N1 | lax.art hero entrance: lax.art-scoped token, at least as slow as 650ms, transform only, never hidden at rest; MO15 edit reverted | **Done** | `apps/art/src/app/base.css:142` defines `--art-hero-panel-duration: var(--motion-duration-xl)`, and `:195` sets `--motion-duration-xl: 900ms`. `:143-144` sets `--animate-art-hero-panel-in: art-hero-panel-in var(--art-hero-panel-duration) var(--motion-ease-emphasize) both`. So the entrance is now 900ms, 250ms slower than main's 650ms, which fits Q3. The new token is defined only in lax.art's `base.css`. The keyframes at `:163-170` go `transform: translateY(1rem)` → `translateY(0)`, with no opacity. The component uses it only behind `motion-safe:` (`art-home-hero.tsx:32`). `home-hero-motion.test.ts:31-46` checks the keyframes and the new token. In `docs/design/motion.md:64` (MO15), the clause "on lax.art's editorial reveal tokens `--motion-duration-lg` and `--motion-ease-emphasize`" is gone. The text now says only "transform only, from a visible start; the drift stays, Q3". The "done in PR 6" status notes stay; they follow the existing "done in PR 4" convention. One nit: the comment at `base.css:140` is 147 characters wide, but CI static checks passed. |
| N2 | Route JS shows 0 higher with a pinned Sentry release; no budget changes | **Mostly done, but the PR body table is broken** | The PR now says both builds used `SENTRY_RELEASE=pinned-release-for-comparison`, with "0 routes higher on any route the budget checks". One entry is +136 B gzip: Bid `/admin/(shared)/collections`, put down to module-id renumbering, with the raw chunk 3 B smaller. That route is outside the budget: `scripts/route-js-budgets.json` sets `apps/web.ignore: ["^/admin", "^/dev/", "^/display/"]`. The PR discloses it openly. No file in the diff matches `budget`, `baseline`, `ratchet` or `allowlist` (checked with `git diff --name-only 121004fd..9c931137`). However, the main → head table in the PR body has lost its numbers. Every Largest, Frame and Page cell reads "KB → KB KB", so the "0 higher" table cannot be read. I could not rebuild four apps here to check the per-entry figures myself. |
| N3 | Cover-picture comment | **Done** | `packages/marketing-ui/src/cover/cover-picture.tsx:16-17`: "(only non-first slides: slide 0 is eager, so it is never hidden, and the others are off screen, so their one-time blink is not seen)". The line at `:17` is also wider than 100 characters (nit). |
| N4 | Basket thumbnails noted | **Done** | The PR body has a "Basket thumbnails (Shop)" bullet saying they appear at once on purpose and are lazy images without the fade. |
| N5 | PR body links work | **Not fixed** | The four links under "Still screenshots" (lax.art first frame, Bid sign-in, Shop print) and two under "Short recordings" (hovered card, reduced motion) still put backticks inside the link target. They now use one to nine backticks, for example ``[before](```` https://…/bid-sign-in-1440-light.png) ````. GitHub renders these as literal text, not links. Even so, "Changes after review" says "the broken screenshot links are fixed in this description". The `tree/` link and the hero and grid clip links work. |
| N6 / N7 | `MarketingHeroReveal` unused; event marquee | Left as noted, and listed as such in "Changes after review". That is fine. |
| — | Tokens only, compositor only, Lenis untouched | **OK** | The only new duration is a token alias. The only changed property is `transform`. The added CSS has no literal ms, `cubic-bezier`, `transition-all` or `will-change`; the only matches are in test fixtures and in the comment. No Lenis file is in the diff. CI `static-checks` (`lint:compositor`) passed on `9c931137`. |
| — | SEO parity | **OK** | Nothing new since the first review: the two new commits change CSS, a comment, a test, docs and binary clips only. |
| — | CI green | **No** | On `9c931137`, 40 of 41 check runs succeeded, including `ci-result`, `build`, `ui-chromium`, `static-checks`, `browser-gates` and `account-browser-gates`. **`art-browser-gates` failed** (job 133425960042). The test `e2e/art-journeys.spec.ts:237`, "favourites tabs are signed-in routes" on `chromium-mobile`, failed three times out of three: it expected `/account/favourites/follows` but the URL stayed `/account/favourites`. The other 141 tests passed. The diff does not touch favourites or account tabs: its lax.art files are only `base.css` and the hero test. So this looks unrelated or flaky, but the required gate is red. Main's merge-group run of the same workflow (43907193850) passed. |
| — | "Changes after review" honest | **Partly** | Most of it is accurate. Two lines are not. "the broken screenshot links are fixed in this description" is false (see N5). "Not re-run after this change: ... CI on the new head" is out of date: CI did run on `9c931137`, and one gate failed. |
| — | No AI footer or trailers | **OK** | The PR body has no generated-by footer. The commits `f1d4aabe..9c931137` have no `Co-Authored-By` or `Claude` trailers. |

### What the clips show

I extracted frames at 4 fps with ffmpeg:

| Clip | Length and size | What it shows |
|---|---|---|
| `art-home-hero-1440.webm` | 4.1 s, 1440×900 | The panel, h1, copy and CTA are drawn from the first painted frame and settle a few pixels up. The photo drift runs. |
| `art-home-hero-375.webm` | 4.0 s, 374×812 | The same at phone width. The panel is visible from the first frame and then settles. |
| `lazy-fade-grid-1440.webm` | 2.6 s | Hatched placeholders, then the pictures fade in, with the intermediate frames visible. |
| `lazy-fade-in-hovered-card-1440.webm` | 2.7 s | Card 1 is hovered with its link underlined, and its picture fades in. The 1.04 zoom is too small to see in the extracted frames. |
| `reduced-motion-hero-and-lazy-fade-1440.webm` | 3.8 s | The hero panel does not move, and the grid fades quickly. |

### To ship

1. Re-run `art-browser-gates` on `9c931137` and get it green. If it fails again, show that the same test also fails on main.
2. Edit the PR body:
   - Fix the six links that have backticks in their targets.
   - Restore the numbers in the route-JS table.
   - Correct the two out-of-date lines in "Changes after review".

All of this is the PR description and a CI re-run. No code change is needed. Every code item from the review is resolved.
