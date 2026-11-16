Verdict: SHIP

# Last recheck of PR #1486 (motion-hover-press): motion system 4/8, hover and press

This recheck covers head `ecb6a197` ("Hover and press: second round of review fixes"). That head merges main at `5569ca0e`. It checks the three blocking findings of the previous review on this branch (`38eaeaf1`, at `5cb2c92f`) and that review's non-blocking quick-look note. It also checks the PR body's "Changes after review (round 2)". The PR branch was not changed.

All three blocking findings are resolved:

1. **CI is green.** All 41 checks pass, including all 8 `web vitest` shards.
2. **Route JS does not grow.** CI's own tables still read +0.1 to +0.2 KB on three groups. However, I rebuilt main and the PR myself with every random input pinned, and every route is lower in the PR, to the byte.
3. **The PR body now matches the code**, apart from two small wording points listed under non-blocking.

## Blocking

None.

## Non-blocking

1. **The PR's own pinned byte figures do not reproduce, though its conclusion does.**
   - My pinned builds used the same recipe the PR body describes (see "Route JS" below).
   - For `/(client)/purchases/collect`, they give main 483,248 B and PR 483,185 B, so −63 B. The PR body says 483,297 → 482,908, so −389 B.
   - For `/account/profile`, they give 446,447 → 446,445, so −2 B. The PR body says 446,366 → 446,365.
   - The pinned group table in the body has the same kind of gap: it says PR web checkout is 471.6, where I get 471.9 for both main and the PR.
   - The direction holds on every route: there is no growth. It is worth correcting the figures so the merge record is accurate, but this does not block.
2. **The interest pickers' border does fade; it does not change at once.**
   - The PR body says "Their border and shadow change at once", and so do the code comments at `apps/web/src/components/onboarding/buyer-interests-form.tsx:115` and `apps/web/src/components/dashboard/auction-interests-settings-form.tsx:180`.
   - In fact the border fades:
     - An unchecked tile has `lax-card-lift`. That rule is unlayered, so it beats the Tailwind utility, and it transitions `border-color` over `--lax-motion-hover` (`packages/ui/src/lax/hover-press.css:36-38`).
     - A checked tile keeps `transition-colors`, which also includes `border-color`.
   - Only the shadow switches at once. That is the part MO15 cares about, so the behaviour is right; only the wording is wrong.
3. **The hang depth is equal in alpha, not in geometry.** The body says "exactly as deep as before". The layer's alphas do composite to the old hover alphas:
   - light: 1−0.86·0.953 ≈ 0.18 and 1−0.66·0.848 ≈ 0.44
   - dark: 0.5 and 0.8

   (`packages/marketing-ui/src/marketing-ui.css:276-290`). However, the layer's offsets and blurs (2/20 and 2/22) differ from the resting ones (1/14 and 1/16), so the two shadows overlap only partly. Visually this is close enough, but "exactly" overstates it.
4. **The `ui-chromium` trigger list misses one file the suite reads.**
   - `hover-press-resolved.test.ts:583` loads `packages/marketing-ui/src/marketing-header.css`.
   - The job's `css_inputs` (`.github/workflows/ci.yml:387`) does not list that file.
   - So a PR that changes only that stylesheet would skip the Chromium suite. Add it in a follow-up.

## Verified

### Blocking 1: CI fully green

- The `ecb6a197` check runs report 41 of 41 `success`. This covers:
  - every `web vitest` shard, 1/8 to 8/8, including 6/8 (job 133146223152), which failed last time
  - `ui-chromium`, `static-checks`, `build`, `test`
  - `api vitest` 1–2 and `shop-api vitest` 1–4
  - `browser-gates`, `art-browser-gates` and `account-browser-gates`
  - all shop-v1 smokes, the docker images and `ci-result`
- The fix is in `apps/web/src/components/layout/site-header.test.tsx:264-273`. The test now asserts that `marketing-header-surface` is present, and that the class string has no `transition` and no `backdrop-filter` (apart from the `supports-[backdrop-filter]:` query).

### Blocking 2: route JS

**CI tables, compared row by row.** Values are largest / frame / page in KB. The PR is the `build` job 133146222974 of run 43821661884.

- Main's newest merge-group run (43823082241 at `8ed75236`, docs only) built nothing ("No production builds found"). So the latest main tables with data are:
  - web: run 43819811178 at `f1e70f47`, job 133140258965
  - Shop, art and Account: run 43818820212 at `9f368bd4`, job 133137626187

| group | main CI | PR CI (`ecb6a197`) |
|---|---|---|
| web account | 545.3 / 442.6 / 102.7 (`f1e70f47`) | **545.4** / 442.7 / 102.6 |
| web checkout | 471.7 / 441.0 / 30.7 | **471.9** / 441.1 / 30.8 |
| web listing / lot / public / sale | 462.3 / 467.5 / 394.6 / 478.9 | 462.1 / 467.4 / 394.5 / 478.8 (lower) |
| Shop account / checkout / product / public | 520.4 / 551.8 / 552.9 / 520.5 | 520.3 / 551.7 / 552.8 / 520.4 (lower) |
| art account / product / public | 522.0 / 524.1 / 527.7 | 522.0 / 524.0 / 527.6 (equal or lower) |
| Account account | 436.0 / 405.1 / 31.0 (`9f368bd4`) | **436.2** / 405.1 / 31.1 |

- Tracked routes are all equal or lower: Home 394.5, Sales list 442.8, Sale 478.8, Lot 467.4, About 344.9, Terms 341.9.
- Taken alone, CI fails the no-tolerance rule on three groups: web account +0.1, web checkout +0.2 and Account +0.2.
- Main's own CI shows the same noise without any code change on these routes. Across three consecutive main runs:
  - web account read 545.2 (`5569ca0e`), then 545.4 (`9f368bd4`), then 545.3 (`f1e70f47`).
  - Checkout frame read 441.0, then 441.1, then 441.0.
- The CI `build` job sets neither `SENTRY_RELEASE` nor `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. This matches the PR's explanation.

**An independent like-for-like pinned build. This is what decides the finding.** I did not rely on the PR's figures.

- **Setup:**
  - one worktree (`/home/user/pinned`), built in the order: PR `ecb6a197`, then main `5569ca0e`, then PR `ecb6a197` again
  - each time: `git clean -fdx` (keeping `node_modules`), removal of `.next` and `.turbo`, then `pnpm install --frozen-lockfile`
  - `pnpm turbo run build --env-mode=loose --force --filter=@auction/web --filter=@auction/account`
  - the environment of CI's `build` job (the four placeholder DSNs and `NODE_OPTIONS=--max-old-space-size=6144`), plus `SENTRY_RELEASE=budget-pinned` and one fixed `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- **Measurement:** `scripts/check-route-js-budget.mjs --all`, plus a byte-exact dump made with the same `auditApp` / `startupSet` functions.
- **The build is deterministic.** The two PR builds are byte-identical on all 134 routes (114 web, 20 Account), so differences against main are code, not noise.
- **Main → PR, exact gzip bytes:** no route grows, out of 134.

| group (largest route) | main (pinned) | PR (pinned) | change | worst route in group |
|---|---|---|---|---|
| web account (`/(client)/selling/consignments/[id]/edit`) | 558,554 | 558,491 | −63 B | −38 B |
| web checkout (`/(client)/purchases/collect`) | 483,248 | 483,185 | −63 B | −52 B |
| web listing | 473,185 | 473,054 | −131 B | −52 B |
| web lot | 478,550 | 478,460 | −90 B | −52 B |
| web public | 403,861 | 403,797 | −64 B | −38 B |
| web sale | 490,267 | 490,103 | −164 B | −164 B |
| Account account (`/account/profile`) | 446,447 | 446,445 | −2 B | −2 B (every route, incl. `/account/security/delete` 421,738 → 421,736) |

  In KB the pinned groups read, main → PR:
  - web account: 545.5 → 545.4
  - checkout: 471.9 → 471.9
  - listing: 462.1 → 462.0
  - lot: 467.3 → 467.2
  - public: 394.4 → 394.3
  - sale: 478.8 → 478.6
  - Account: 436.0 → 436.0

  Tracked routes are all lower: Home 394.4 → 394.3, Sales list 442.8 → 442.7, Sale 478.8 → 478.6, Lot 467.3 → 467.2, About 344.8 → 344.8, Terms 341.8 → 341.7.
- **Conclusion:** like for like, this PR adds zero bytes to any web or Account route, and the CI +0.1/+0.2 is per-build ID noise. I accept it.
- Shop and art were not rebuilt. In CI they are already equal or lower against main.

**Budgets are untouched.** `git diff 5569ca0e ecb6a197` touches none of `scripts/route-js-budgets.json`, `scripts/route-js-baseline.json` or any ratchet file.

**The compositor allowlist only shrinks.**
- `scripts/compositor-allowlist.json` has 0 `+` lines and 100 `-` lines.
- It goes from 46 entries to 26, and no entry is added (checked as sets).

**The CI workflow change only widens coverage.** `.github/workflows/ci.yml` adds `hover-press-resolved.test.ts` and four stylesheets to `ui-chromium`; nothing is removed or skipped.

### Blocking 3: PR body against the code

- **Lift token.** The body now says `--lax-motion-lift` (300ms). That matches the code:
  - `packages/branding/public/lax-system.css:154`
  - `packages/ui/src/lax/hover-press.css:37`
  - `docs/design/motion.md:23`, `:37`
- **Hang shadow.** The body now says rest plus layer equals the old hover shadow. The alphas check out (`packages/marketing-ui/src/marketing-ui.css:276-290`), with the geometry nit in non-blocking 3. The layer is mouse-gated (`:304-308`).
- **Interest tiles.** The body now says they are converted. They are:
  - `lax-card` / `lax-card-lift` in `buyer-interests-form.tsx:116-119`, with `lax-card-zoom` at `:143`
  - `auction-interests-settings-form.tsx:181-184`
  - colour transitions on `--lax-motion-hover` / `--lax-ease-out`
  - the border wording is non-blocking 2
- **Header surface.** It is now described, and it matches the code:
  - `use-header-chrome.ts:134` carries `marketing-header-surface` and no transition utility.
  - `marketing-header.css:141-150` fades only background and border on `--lax-motion-panel`, and sets `transition: none` under reduced motion.
- **Test counts.** I reproduced every count in the body:
  - Chromium: 32 + 50 = 82
  - web: 1520 files, 9892 passed, 10 skipped
  - Account: 1071
  - marketing-ui: 709
  - ui: 676
- **Route JS section.** The CI tables in the body match the CI logs. The pinned figures do not reproduce exactly (non-blocking 1).

### Quick-look thumbnail change (previous non-blocking 4): fixed

- At `apps/web/src/components/marketing/lot-quick-look/quick-look-dialog-sections.tsx:133-136`, `transition-all motion-safe:duration-200` and `scale-95` / `hover:scale-100` are gone.
- They are replaced by `transition-[opacity,border-color] duration-[var(--lax-motion-hover)] ease-[var(--lax-ease-out)]` and `opacity-70 hover:opacity-100`.
- Nothing scales any more, so the ghost button's `lax-press` no longer fights a scale transition.
- The fade is opacity and colour only, which is fine under reduced motion.
- The only literal left in the file is `:222` (`motion-safe:duration-300` on the main image's load fade). This PR does not touch that line.

### Other checks

- **Lenis is untouched.** No Lenis file is among the 70 changed files.
- **No attribution trailers.** None of the 7 commits from `5569ca0e` to `ecb6a197` has a `Co-Authored-By`, `Claude-Session` or "generated by" line.
- **Base.** `5569ca0e` is merged in through a normal merge commit (`80dd692f`). Main has since moved to `8ed75236` (four commits). GitHub reports the PR `mergeable_state: clean`.

## What I ran (at `ecb6a197`, in `/home/user/pinned` after the pinned builds)

- Chromium (`LAX_REQUIRE_CHROMIUM=1`): `src/lax/hover-press-resolved.test.ts` gave 50 of 50, and `src/lax/motion-resolved.test.ts` gave 32 of 32.
- Mutation check M5, new this round: press keyframe `scale: 0.98` → `0.96` in `packages/ui/src/lax/hover-press.css:31`.
  - It was caught: 4 failed and 46 passed. The failures were the button press cases for public and Account, under none and `force-allow-os-reduce`.
  - I reverted it and `git status` was clean.
- Unit suites:
  - `@auction/ui`: 85 files, 676 of 676.
  - `@auction/marketing-ui`: 111 files, 709 of 709.
  - `apps/account`: 118 files, 1071 of 1071.
  - `apps/web`, the whole suite: 1520 files, 9892 passed and 10 skipped, with no failures.
- Pinned route-JS builds and byte comparison, as described above.
- CI evidence came from the check runs on `ecb6a197` and from the `build` job logs of PR run 43821661884 and main runs 43823082241, 43819811178 and 43818820212.
