Verdict: SHIP

Review of PR #1505 (head 2c7a0c0c). Read-only; the PR branch was not changed.

## Blocking
None.

## Non-blocking
1. `packages/observability/src/sentry-shared.ts` (`shouldDropDenoRuntimeNoise`) only inspects `exception.values[0]`. A chained exception whose first value is Deno-only but whose later value has our frames would be dropped. This is a narrow case. It would be safer to check every value.
2. The "our own script" guard is `/_next/` only. Inline `<script>` frames from our pages carry the page URL as `filename`, so they have no `/_next/`. They are still safe, because the rule needs the innermost frame to be `ext:core|runtime|deno_*/`, which only Deno produces. No test covers an inline-script frame. A one-line test (page-URL frame followed by an `ext:core` frame) would document the behaviour. As written, such an event would be dropped, and it is probably Deno noise anyway.
3. The hidden marker spans are siblings of the link. `display:none` spans take no space or gap, but sibling-structural CSS (`:first-child`, `:last-child`, `space-x/y`, `[&>*+*]`) around art contact lists and the team band could shift. I could not run the browser gates locally. CI `art-browser-gates` is green, which suggests no visual regression, but I did not compare screenshots.
4. The PR body claims "route JS equal or lower". It only says the growth is "a few hundred bytes" and that no budgets were changed. I did not measure it. `EmailOff` has no `"use client"`, so it stays server-only where used from server components. In client bundles it adds a tiny wrapper. No budget files are in the diff.

## Verified
- Every `mailto:` render path in lax.art goes through `EmailOff`.
  - `apps/art/src/components/editorial/art-editorial-link.tsx:28-35` covers venue location and exhibition contact links, via `art-venue-location.tsx:60` and `art-exhibition-contact-links.tsx:18`.
  - `apps/art/src/components/art-status-state.tsx:80-90` covers account-disabled and sign-in-error support links (`account/disabled/page.tsx:21`, `sign-in-error/page.tsx:18`).
  - `packages/marketing-ui/src/email-text.tsx:46-55` is `EmailLink`, used by the general enquiry panel. `aria-label={address}` is unchanged.
  - `packages/marketing-ui/src/marketing-gallery-team-band.tsx:42-51` wraps only `mailto:` hrefs.
  - A grep of `apps/art` and `packages/marketing-ui` found no other mailto sites.
- The approach matches Cloudflare's documented opt-out: `<!--email_off-->` ... `<!--/email_off-->` (`packages/marketing-ui/src/email-off.tsx`).
  - The markers sit in `<span hidden>` via `dangerouslySetInnerHTML` (React can't emit comments), so they are in the server HTML.
  - The link is a plain `<a href="mailto:...">` in server HTML. With obfuscation on, the edge skips it. With it off, nothing changes.
  - The accessible name is unchanged. The spans are `hidden`, so they are not announced and take no layout.
- No Cloudflare zone settings are touched (diff is 12 source and test files). The PR body says the zone setting is the owner's/infra choice.
- The Sentry filter lives in the shared `packages/observability`. It is wired into `createNextSentryOptions.beforeSend` (`next-sentry-options.ts:29`). `createNextBrowserErrorOptions` derives from it, and the web, art and account configs use it, so it is applied consistently.
- The filter drops only when the innermost frame matches `^ext:(core|runtime|deno_*)/` and no frame contains `/_next/`.
- Tests in `sentry-shared.test.ts` and `next-sentry-options.test.ts` cover:
  - Deno-only frames, which are dropped.
  - Our `_next` frame innermost, our frame under a runtime frame, no frames, and a page-URL frame, which are all kept.
  - The `beforeSend` wiring.
  - Render tests assert real `mailto:` between the markers and no `/cdn-cgi/` rewrite. Each would fail if the marker spans or the Deno rule were removed. This is by inspection of the assertions, not by running the mutation.
- CI on the head commit: `ci-result`, `build`, `test`, all web, api and shop-api vitest shards, `art-browser-gates`, `account-browser-gates` and `browser-gates` are success. The earlier typecheck failure (missing `EmailOff` import) was fixed in 2c7a0c0c.
- The PR body is accurate, has no AI footer, and has no budget changes. The test fixtures use synthetic frames and the placeholder addresses `info@lax.art` and `support@lax.bid`. No real event payloads or personal data are committed.

## Not verified
- I could not run the tests locally (dependencies are not installed in this sandbox: ERR_MODULE_NOT_FOUND). I relied on CI and on reading the diff.
- I did not measure route JS sizes.
