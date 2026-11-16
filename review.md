Verdict: FIX FIRST

# Review of PR #1499: Bid: account banner and Register button follow the real registration state

Branch `bid-account-banner-registration-state` at `05e91fb4`, which is based on main `14f44616`. This review did not change the PR branch.

The diagnosis of the chip is right, and the two specific fixes do work: the chip now says what is held, and an approved registrant sees "View lots". Four things block it:

- CI is red.
- The bottom bar still disagrees with the hero in several states, and a new test treats one of those disagreements as correct.
- "Is registered" is now worked out twice instead of in one place.
- The screenshots are hand-made mock-ups, not captures of the app.

## Blocking

1. **CI is red: `static-checks` fails on the PR's own new file.** Biome `organizeImports` fails on `apps/web/src/components/sections/saleroom/saleroom-viewer-islands.test.tsx:1-2`. The two `@/components/...` imports are in the wrong order (job 133290590628: "Found 1 error"), so `ci-result` fails too. `browser-gates` was still running when this review was written. The fix is to sort the imports with `biome check --write`; don't skip the check.

2. **The bottom bar still does not match the hero for every state.** The PR only retires "Register" for an approved registration. In every other case where `isUpcoming && canParticipate` holds, the bar still shows "Register" and links to `/register` (`sale-mobile-summary-bar.tsx:177-179`). That route is the "Create account" hosted-auth page (`app/(task)/register/page.tsx:5-8`), not sale registration. Compared with the hero (`saleroom-hero-action-row.tsx:111-128`, `saleroom-register-to-bid.tsx:313-345`):

   | State | Hero | Bar | Match |
   |---|---|---|---|
   | Signed out | "Register to bid" → hosted sign-up with `next` back to the sale | "Register" → `/register` with no `next` | Label close; loses the way back to the sale |
   | Signed in, identity check not approved | "Verify identity to bid" (or the KYC label) → identity onboarding | "Register" → create account | **No** |
   | Identity approved, private collector (no buyer-agent account), not registered | No register button ("no extra registration needed for private collectors", `saleroom-register-to-bid.tsx:404-412`) | "Register" → create account | **No** |
   | Identity approved, buyer agent, registration none, pending, rejected or withdrawn | "Register to bid" → `#register-to-bid` form | "Register" → create account | Label only; wrong destination |
   | Registration approved | "You're registered" | "View lots" | Yes (this PR) |
   | Sale takes no web registrations (`registerToBidSale=false`) | No register | "Register" (the bar never receives `registerToBidSale`, `saleroom-detail-view.tsx:54-66`) | **No** |
   | Live (`active`), not registered | Register to bid (`LIVE.register = true`, `sale-lifecycle-actions.ts:14`) | "View lots" | **No** |
   | Ended, cancelled or voided | No register | "View results" | Yes |
   | Onsite sale | "Plan your visit" | Calendar, directions or "Plan visit" | Yes |

   The new test `saleroom-viewer-islands.test.tsx:59-61` asserts that "not registered, KYC pending" and "registration pending" show **Register**. That fixes the mismatch in place instead of catching it. Better: the bar should take the hero's decision, not a parallel one. The hero's primary action (label, href, or none) should come from one presenter that both islands call, so the bar shows exactly what the hero shows.

3. **"Is registered" is derived twice, not shared with the hero.** `viewer.myRegistrations.some((r) => r.status === "approved")` is copied at `saleroom-viewer-islands.tsx:56` (hero) and `:72` (bar). If what "registered" means changes (for example, a paddle number assigned, or a registration for the acting account only), the two will drift apart again, which is the same kind of bug this PR fixes. Compute it once, for example a `hasApprovedRegistration` field built in `buildSaleViewerVM` (`lib/marketing/sale-viewer.ts`) or one exported selector, and have both islands read it. This also fits the presenter in item 2.

4. **The screenshots are not evidence of the change.** The PR's README says so itself (`docs/design/screenshots/bid-account-banner/README.md:3-4`): they are "static mock-ups … not captures of the running app". So they cannot show:
   - whether "Payment on hold while checks finish" plus "See why" fits the real 44px strip at 375px without truncating;
   - the real header chip at 640px and up;
   - that nothing else changed visually.

   Also, the "Mocked data · after" watermark overlaps the "See why" action in `after-375-light.png` and `after-375-dark.png`. Replace them with real captures of the app on seeded, mocked data, at 375 and 1440, in light and dark.

## Non-blocking

- **The "refused" case gets a false label.** An organisation that is rejected or archived produces `in-review` entries with `refused: true` (`packages/domain/src/amounts-owed.ts:109-127`). So the chip says "Payment on hold while checks finish", but no checks are running. Purchases says "`<Org>` can't make payments" with "Contact client services" (`purchases.vm.ts:559-566`). `ClientAttention` could carry `refused` (it is already in `AmountsOwedSummary.refused`), and the chip could say, for example, "Payments closed for this account".
- **The wording for this state now differs across products:**
  - Bid chip: "Payment on hold while checks finish" or "Documents needed to pay"
  - Purchases banner: "Your account is in review", "We need some documents before you can pay." (`purchases.vm.ts:552-555`)
  - Pay: "is in review and can be paid once we have checked it" (`pay/pay-copy.ts:33`)
  - LAX Account Home: "waiting on identity checks" (`apps/account/src/server/domain/home-needs-you.vm.ts:37`)

  The chip links to Purchases, whose heading still says "Your account is in review", which is the same words the PR removes from the chip. LAX Account's "identity checks" is also wrong for an AML or source-of-funds hold on someone whose identity check is approved. Agree one phrase and use it in all four places, as a follow-up if not here.
- **Copy location.** The new labels are inline in `client-attention.ts:148-152`. This matches how the neighbouring chip labels are written (outbid, payment due and still to send are all inline). There is no navigation copy module, so this is acceptable. The `kind` is still `"account-in-review"` (`client-attention.ts:146`, `bid-attention-prompt-chip.tsx:15,23`), which now misnames the state; consider `"payment-on-hold"`.
- **A wrong button can flash while the viewer loads.** The server and client both render the signed-out viewer first (`sale-viewer-provider.tsx:25`), so hydration matches. But until `/api/sales/:id/me` answers, a registered bidder whose bar is already visible sees "Register" and then "View lots". The bar is visible at once when the page opens at `#catalog` or with restored scroll. The hero has the same problem with its "You're registered" badge. Consider rendering the bar CTA as a neutral "View lots", or nothing, until the viewer has loaded.
- **The test names show quoted strings.** The `it.each` titles use `$0 … $3` with array rows and render as `'not registered, KYC approved' shows 'Register'`. `%s` would read cleaner. The test also mounts `CookieDock` and `MarketingBottomTabBar` without saying why.
- **Not confirmed against live data:** whether the person in the 16 Nov test actually had a purchase on hold. The chip only appears when `paymentsDue > 0 && paymentsInReview`, so it must have. Before closing the incident, it is worth checking that account's hold reason (AML or source of funds) on test.

## Verified

- **Where the chip's data comes from, end to end:**
  - `/api/me/menu-context` (`app/api/me/menu-context/route.ts:17`) → `loadAccountMenuContext` → `loadClientAttention` (`lib/navigation/client-attention.server.ts:18-32`) → `GET /users/me/account/amounts-owed` (`lib/data/http/amounts-owed.server.ts:42`) → `deriveClientAttention` (`derive-client-attention.ts:31-43`) → `attentionChip` (`client-attention.ts:178`).
  - On the client it is read through `useAccountMenuContext` → `useBidAttention` (`hooks/use-bid-attention.ts:31-36`). The JSON is passed through unchanged, so the new `paymentsBlocker` reaches the client and no schema drops it.
  - The chip appears in `BidAttentionPromptChip` (header chip and phone strip, CTA "See why", `bid-attention-prompt-chip.tsx:23`), in `bid-header-signed-in-account.tsx:143`, and in `use-header-account-menu.ts:53`. The tab-bar dot comes from `bid-bottom-tabs.ts:42`.
- **The cause analysis is right.** On the API, `in-review` comes only from purchases owed (`apps/api/src/services/amounts-owed/amounts-owed.service.ts:143-145`). For a personal account the hold comes from `getBuyerComplianceGateStatus` (`apps/api/src/services/payment/payment-buyer-ops.ts:84-97`), which is the AML or source-of-funds settlement check and is independent of the identity check and of sale registration. So a person whose identity check is approved, and who has an unpaid purchase under an AML or source-of-funds hold, sees the chip.
- **No other site-wide "in review" message for an approved person:**
  - `KycVerificationBanner` ("Identity verification in review") renders only on My bids (`app/(client)/bids/bids-page-content.tsx:86`) and only while the identity check awaits a decision.
  - The KYC labels (`kyc-copy.ts:35`, `kyc-link-action-copy.ts:11-13`) depend on the KYC phase.
  - `kyc-blocker.presenter.ts:29` appears only when the identity check is blocking.
- **The chip still never shows when nothing is owed,** even with a stale in-review flag (`client-attention.ts:147`, test `client-attention.test.ts:73-79`). It still links to `/purchases` (`client-attention.ts:154`).
- **The "documents" blocker comes through correctly.** Documents take priority over review and the value is null once released (`derive-client-attention.ts:43`, `packages/domain/src/amounts-owed.ts:166`).
- **Tests:** the 7 touched web suites pass, 90 of 90 (`vitest run` on `bid-attention-prompt-chip`, `sale-mobile-summary-bar`, `saleroom-viewer-islands`, `account-buying`, `client-attention`, `derive-client-attention`, `header-account-menu.vm`).
- **Mutation check:** with main's source for `sale-mobile-summary-bar.tsx`, `saleroom-viewer-islands.tsx`, `client-attention.ts` and `derive-client-attention.ts` under the PR's tests, 8 tests fail across 5 suites. The new tests do catch the change. The `bid-attention-prompt-chip` suite mocks the chip state, so it only checks the label it is given; that is expected.
- **Typecheck:** `tsc -p apps/web/tsconfig.json --noEmit` exits 0.
- **Route JS was not measured here.** The change is one boolean prop and two string literals in already-loaded client modules, so a material increase is unlikely. Confirm it once `browser-gates` and the bundle budget finish, without raising any budget.
- **No real personal data:** the fixtures and screenshots use "Spring sale", "Harbour at Dawn" and a mocked bidder.
