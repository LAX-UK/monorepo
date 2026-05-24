# Tracking overview (for marketing)

A plain-English guide to how analytics and conversion tracking work on **lax.bid**. Aimed at the marketing team — read alongside [`sgtm-setup.md`](./sgtm-setup.md) if you need the technical operations side.

**Status**: production-only. Local dev and CI deployments do not run any tracking at all.

---

## 1. The big picture

```
  Visitor's browser                Our infrastructure                External tools
 ┌──────────────────┐         ┌─────────────────────────┐        ┌─────────────────┐
 │                  │         │                         │        │   GA4 property  │
 │  lax.bid         │ events  │  gtm.lax.bid            │ events │  G-GDG4D2YELR   │
 │  (Next.js web)   │────────▶│  (server-side GTM       │───────▶│                 │
 │                  │  via    │   container GTM-575HV8LQ│        ├─────────────────┤
 │   GTM-W6K4N67Z   │  GA4/   │   hosted on Stape)      │        │   Meta Ads      │
 │   web container  │  POST   │                         │        │  (Pixel + CAPI) │
 │                  │         │                         │        └─────────────────┘
 └──────────────────┘         └─────────────────────────┘
        ▲                              ▲
        │                              │
        │ also (for conversions)       │
        │ ┌────────────────────────────┘
        │ │
 ┌──────┴─┴────────┐
 │  Our API +      │  conversion events
 │  worker         │  (Purchase, KYC, etc.)
 │  (api.lax.bid)  │
 └─────────────────┘
```

There are **two kinds** of tracking, working together:

1. **Browser tracking** — fires when the visitor does something on the site (page view, viewing a lot, searching, etc.). Sent from the browser into Google Tag Manager.
2. **Server tracking** — fires when something important happens on our backend (payment captured, KYC approved, etc.) even if the browser is closed. Sent directly from our API to Google/Meta.

Both routes are routed through **one address** that we control: `https://gtm.lax.bid` (currently hosted at Stape). That single point of control is how we apply consent, deduplicate events, and add the things Meta needs to match the visitor to an ad click.

---

## 2. What needs to be true for tracking to fire

Tracking is **off by default** and only switches on when ALL of these are true. If any are false, nothing happens — no GTM script loads, no dataLayer pushes, no server events sent.

| Condition | Required for |
|----|----|
| Deployment is the **production** build of the site | All tracking |
| `NEXT_PUBLIC_GTM_ID` is set (`GTM-W6K4N67Z`) | All tracking |
| Visitor has chosen **Analytics: ON** in the cookie banner | Browser tracking (GTM loads) |
| Visitor has chosen **Marketing: ON** | Conversion events (bid, signup, purchase, etc.) and Meta-specific fields (`_fbp`/`_fbc`) |
| `gtm.lax.bid` returns 200 | Server-side GTM forwarding to GA4 / Meta |
| Meta env vars set (`META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `GA4_MEASUREMENT_ID`) | Server-side Meta CAPI fallback |

**Important**: nothing tracks in local dev or staging. If you can't see hits on a developer's machine, that's expected — test on production with a fresh incognito window.

---

## 3. The cookie consent banner

When a visitor lands on the site, our consent system checks whether they've made a choice before (by reading the `lax_consent` cookie). If not, the **cookie banner** appears at the bottom of the page.

### Banner buttons

| Button | Result |
|----|----|
| **Accept all** | Analytics ON, Marketing ON. Everything starts firing immediately. |
| **Reject all** | Analytics OFF, Marketing OFF. GTM never loads, no events fire, no `_fbp`/`_fbc` cookies are read. |
| **Customise** | Opens a dialog to toggle the two categories independently. |

### Inside the "Customise" dialog

There are **two switches**:

- **Analytics** — controls Google Tag Manager, Google Analytics 4, and any analytics tags inside GTM.
- **Marketing** — controls advertising/remarketing tags (e.g. Meta Pixel + Conversions API) and reading of marketing cookies (`_fbp`, `_fbc`).

**Marketing is gated on Analytics.** You cannot turn Marketing on while Analytics is off. If a visitor turns Analytics off, Marketing is forced off as well (the switch is disabled and the toggle reverts). This is intentional — GTM is the runtime that fires marketing tags, so without analytics consent there is no place for marketing tags to run.

### Footer link

The cookie banner is **not the only entry point**. There is a **"Cookie preferences"** link in the site footer that opens the same Customise dialog. Visitors can change their mind at any time.

### What the consent choice persists

The choice is stored as a cookie called `lax_consent`, valid for **365 days**, on `.lax.bid` (so it applies across subdomains). The cookie contains the version, timestamp, and the two booleans. It is read by:

- The browser, before loading GTM
- The browser, before firing any conversion event in the dataLayer
- The API, via `x-lax-consent-marketing` / `x-lax-consent-analytics` headers the browser attaches to API requests — this is how the server knows whether to publish conversion events for that user

### What happens before a visitor makes a choice

- GTM does **not** load.
- No analytics events are sent.
- Google Consent Mode is set to **"denied" by default** for analytics, ads, ad_user_data, ad_personalization, personalization. This means Google's pings (which it sends regardless) carry zero personalization signals.

---

## 4. What we track

There are two layers, with overlap by design.

### Layer A — Browser dataLayer (Google Analytics / GTM tags only)

These fire from the visitor's browser when the visitor does something on the site. They go into the `dataLayer` array, which GTM picks up and dispatches to GA4 (and any other tags configured inside GTM).

| Event | When it fires | Consent needed | Data sent |
|----|----|----|----|
| `page_view` | Any client-side route change (we override this because Next.js doesn't fire it natively) | Analytics | path |
| `view_item` | Visitor opens a lot detail page | Analytics | lot id, title, price, currency |
| `view_item_list` | Visitor sees a list of lots (sale page, search results) | Analytics | list id, list name, item ids |
| `search` | Visitor submits a search query in the header search | Analytics | search term |
| `sign_up` | Successful registration (email) | Analytics + Marketing | method |
| `login` | Successful sign-in (email) | Analytics + Marketing | method |
| `add_to_wishlist` | Visitor adds a lot to their watchlist | Analytics + Marketing | lot id |
| `begin_checkout` | Visitor opens the checkout flow on a won lot | Analytics + Marketing | lot id, value, currency |
| `purchase` | Visitor reaches the post-payment confirmation page | Analytics + Marketing | transaction id, lot id, value, currency |

Each event also carries a unique `event_id` (UUID). This is critical — it lets us **deduplicate** the browser event against the matching server event so Meta doesn't count a single purchase twice.

### Layer B — Server-side conversion events (Meta CAPI + GA4 via sGTM)

These fire from our backend, regardless of the browser. They are essential for events that happen **after the visitor closes the browser** or where ad blockers would otherwise hide them from the Meta Pixel.

| Event | When it fires | Source | Consent basis |
|----|----|----|----|
| `Lead` | New user registers (email signup) | API `POST /users/register` | Visitor's marketing consent at signup |
| `CompleteRegistration` | KYC approval | Veriff decision webhook | Legitimate interest (no browser at event time) |
| `InitiateCheckout` | Visitor starts payment | API `POST /payments` | Visitor's marketing consent |
| `Purchase` | Payment captured | Stripe webhook | **Legitimate interest** — fires even if no consent was given because the visitor has already entered a contractual relationship and we need to reconcile ad spend |
| `AddToWishlist` / `RemoveFromWishlist` | Watchlist API | API | Visitor's marketing consent |

Documented in detail in [`docs/privacy/dpia-meta-capi.md`](../privacy/dpia-meta-capi.md).

### Not currently tracked

A few hooks exist in the codebase but are **not wired up** in production. If you ask "where do my bid events go?", the honest answer today is "nowhere". Specifically:

- **Bid placed** — neither browser (`bid_placed` dataLayer event) nor server (`BidPlaced` CAPI event) is emitted today. The plumbing exists (`trackBidPlaced` function, `BidPlaced` type) but no code calls it. If bidding analytics matters, a developer needs to wire the call site in the bid submission flow.

### Why server-side is necessary

- Around **30-40% of browser events** are lost to ad blockers, iOS Safari ITP, brave/firefox tracking protection, slow networks, page closes before the pixel fires, etc. Server-side recovers all of those.
- `Purchase` is the most important to recover — Stripe captures payment **asynchronously** via webhook, often seconds or minutes after the visitor leaves. Without server-side, the browser pixel might fire on the "thank you" page but a meaningful share of buyers never get there.
- KYC happens **out-of-band** — Veriff tells us asynchronously, sometimes hours later, when there is no browser session at all.

---

## 5. The Meta Pixel / `_fbp` and `_fbc` cookies

When a visitor with **Marketing consent** lands from a Facebook/Instagram ad, Meta sets two first-party cookies in their browser:

- `_fbp` — Meta's browser-level identifier.
- `_fbc` — the click identifier from the ad URL (`fbclid=...`).

Once they sign in, we capture these via an authenticated POST from the browser to our API (`POST /marketing/click-ids`), store them against the user for **90 days**, and attach them to every server-side conversion event we send to Meta. This is what lets Meta match a server-side `Purchase` event back to the original ad impression.

If the visitor never gives marketing consent, we never read these cookies and never store them.

---

## 6. Google Consent Mode v2

We fully implement **Google Consent Mode v2**. Before any tag fires, the visitor's consent state is pushed into the `dataLayer` as:

| Consent signal | Driven by |
|----|----|
| `analytics_storage` | Analytics toggle |
| `ad_storage` | Marketing toggle |
| `ad_user_data` | Marketing toggle |
| `ad_personalization` | Marketing toggle |
| `personalization_storage` | Marketing toggle |
| `functionality_storage` | Analytics OR Marketing |
| `security_storage` | Always granted (always on) |

This means:

- Google's tags (and any third-party tags in GTM that respect Consent Mode) will receive pings even without consent, but those pings carry **no personalization** data — they're modelled, not measured.
- The moment a visitor grants consent, full personalized measurement turns on without a page reload.

---

## 7. Where everything lives

These IDs **appear in any browser network tab** when the site loads. They are safe to share in tickets, agency briefs, screenshots, and this document.

| Thing | ID / location |
|----|----|
| Web container (browser side) | `GTM-W6K4N67Z` |
| Server container (server-side GTM) | `GTM-575HV8LQ` |
| Google Analytics 4 property | `G-GDG4D2YELR` (configured inside the server container) |
| Server-side GTM URL | `https://gtm.lax.bid` (hosted on Stape; set as the GA4 `transport_url`) |
| GTM Preview | Google Tag Assistant (`https://tagassistant.google.com/`) or Stape preview in the Stape dashboard |
| Meta Pixel ID | Held in env var `META_PIXEL_ID` (the Pixel ID itself is visible in browser pixel calls — not a real secret, just kept out of the repo as a config value) |

### Real secrets — never share their values

The values of these env vars must **never** leave our secrets manager (Terraform / GitHub secrets). Anyone holding `META_CAPI_ACCESS_TOKEN` can post fake conversions to our Meta account and pollute attribution, optimisation, and ad spend.

| Secret | What it does |
|----|----|
| `META_CAPI_ACCESS_TOKEN` | Bearer token for posting server-side conversions to Meta. **Never share.** |
| `META_CAPI_TEST_EVENT_CODE` | QA-only code routing test events to Meta's test view. Low-risk but still treat as confidential. |

If a Meta rep, an agency, or anyone else asks marketing to share `META_CAPI_ACCESS_TOKEN` — even "just to debug" — the answer is **no**. They don't need it. They debug through Meta Events Manager → Test events using their own Meta access.

---

## 8. How to configure new tags

Because the heavy lifting is in **two GTM containers** (web `GTM-W6K4N67Z` + server `GTM-575HV8LQ`), most marketing changes do **not** require any developer involvement. Examples:

| You want to... | Where you change it |
|----|----|
| Add TikTok Pixel or LinkedIn Insight Tag | Web container — add a tag and a trigger that fires on consent |
| Change which events GA4 receives | Server container — adjust the GA4 client or add transformations |
| Add a new conversion goal in GA4 | GA4 admin — mark an existing event as a conversion |
| Add a Meta custom audience based on `view_item` | Meta Ads Manager — uses existing CAPI events |
| Use a different GA4 property | Server container — change the measurement ID in the GA4 client |
| Add a new marketing/advertising vendor | Web or server container, depending on whether the vendor needs browser data or server-side data |

> **Privacy review required before publishing a new vendor.** Adding any new advertising or analytics vendor (TikTok, LinkedIn, Reddit, etc.) is mechanically a GTM-only change, but it also changes our **DPIA sub-processor list** (currently Google, Meta, Stape — see §10) and may require updates to the **cookie banner copy** and privacy notice. Loop in privacy/legal **before** you publish the GTM container — not after. Switching GA4 properties or adding a new conversion goal in an existing vendor does **not** require this review.

You will need a developer to:

- Add a **new event type** that doesn't already exist (e.g. tracking a brand new user action that isn't on the list above).
- Change what **server-side data** is sent (e.g. adding a new field to `Purchase`).
- Change the **consent rules** (e.g. allowing a tag to fire without consent — this almost always means GDPR review).
- Move or rename `gtm.lax.bid`.

---

## 9. How to validate something is working

### Quick smoke test (no GTM admin needed)

1. Open **https://lax.bid** in a fresh **incognito** window.
2. Accept **Analytics** (and **Marketing** if you're testing conversions) in the cookie banner.
3. Open browser DevTools → **Network** tab → filter by `gtm` or `collect`.
4. Reload the page. You should see requests to `https://gtm.lax.bid/...` returning 200.
5. Go to **GA4 → Admin → DebugView** or **Realtime**. You should see your activity within ~30 seconds.

### Validating a server-side conversion

Use Meta's **Events Manager → Test events** view with `META_CAPI_TEST_EVENT_CODE` set. Trigger an action against a **non-production** environment (or against production using a [Stripe test card](https://docs.stripe.com/testing) on a sandbox flow) and watch for the event to appear, including the `event_id` matching what the browser sent.

**Do not run real card charges to validate tracking.** Use Stripe test cards or Meta's test-event mechanism against pre-existing test data. If the only way to reproduce something is on production with a real card, get an engineer involved and refund immediately.

### Validating consent works

1. Open in incognito → don't touch the banner. No network requests to `gtm.lax.bid` or `googletagmanager.com` should appear.
2. Click **Reject all** → same as above.
3. Click **Accept all** → GTM loads and a `page_view` fires immediately.
4. Open Cookie preferences from the footer → toggle Analytics off → save → reload → GTM no longer loads.

---

## 10. Privacy and compliance summary

- We use first-party cookies only for site operation, consent state, and (with Marketing consent) Meta's `_fbp` / `_fbc`.
- GA4 measurement happens server-side via our own first-party domain `gtm.lax.bid`. Visitor browsers do not directly contact `google-analytics.com` for measurement.
- All PII sent to Meta (email, name, etc.) is **hashed with SHA-256** before leaving our infrastructure.
- `Purchase` and `CompleteRegistration` from the server are sent under **legitimate interest** (GDPR Art. 6(1)(f)) because the visitor has already entered a transactional / verified relationship with us. The full Legitimate Interest Assessment is in [`docs/privacy/dpia-meta-capi.md`](../privacy/dpia-meta-capi.md).
- Visitors can withdraw consent at any time from the footer and we stop sending new consent-based events immediately.
- Sub-processors in scope: Google (GTM image + GA4), Meta (CAPI/Pixel), Stape (sGTM hosting).

---

## 11. Troubleshooting: GA4 is not receiving events

Follow this list **in order**. The first three steps verify the browser → web GTM container path; the rest verify the sGTM → GA4 path.

### A. Confirm the visitor's browser is even firing events

1. Open `https://lax.bid` in a **fresh incognito** window and accept **Analytics** on the banner.
2. Open DevTools → **Console** and type:

   ```js
   window.dataLayer
   ```

   You should see an array including objects like `{event: "page_view", event_id: "…"}`. If the array is missing or empty, the web GTM container never loaded — re-check the consent banner state (`document.cookie` should contain `lax_consent=…analytics%22%3Atrue…`) and the value of the `NEXT_PUBLIC_GTM_ID` env var on the production web service.

3. DevTools → **Network** tab → filter `collect`. Reload the page.
   - You should see at least one request to `https://gtm.lax.bid/g/collect?v=2&tid=G-GDG4D2YELR&en=page_view&…` returning 200/204.
   - If you only see requests to `region1.google-analytics.com` (and **not** to `gtm.lax.bid`), the **Google Tag** in GTM-W6K4N67Z is missing the `server_container_url` (or legacy `transport_url`) configuration setting — fix it in GTM web container, then **publish**.
   - If you see neither, the Google Tag is not firing at all. Open **GTM Preview** (`https://tagassistant.google.com/`) against `lax.bid` and check that the "Google Tag - G-GDG4D2YELR" tag fires on the **Container Loaded** / **Initialization** trigger.

### B. Confirm sGTM is up and tag-firing

4. From a terminal:

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" https://gtm.lax.bid/healthy
   ```

   Expected: `200`. If anything else, sGTM is down — investigate Stape (where `gtm.lax.bid` resolves; see [`sgtm-setup.md`](./sgtm-setup.md)).

5. In the GTM web UI, switch to the **server container `GTM-575HV8LQ`** and check **all four** of these:

   | Check | Where |
   |---|---|
   | A **GA4 Client** exists (default name "Google Analytics: GA4") | Clients → must be enabled |
   | A **GA4 tag** ("Google Analytics: GA4") exists with **Measurement ID = `G-GDG4D2YELR`** | Tags |
   | The GA4 tag's trigger fires on **All Events** from the GA4 Client (default trigger when you create the tag) | Triggers |
   | The container is **published** (header banner does not say "Workspace changes") | Versions |

   **Saving is not publishing.** Even after months of edits, until you click **Submit → Publish**, the live `gtm.lax.bid` keeps running the previous published version.

6. In **Tag Assistant** or Stape preview, reload `lax.bid` and confirm:
   - The GA4 Client **claims** each incoming `/g/collect` request.
   - The GA4 tag fires once per claim with status **Succeeded**.
   - If the GA4 tag is **Skipped**, click into it and read the firing condition that failed — usually a consent-check trigger.

### C. Confirm GA4 itself accepts the data

7. Visit `https://lax.bid?gtm_debug=1`. Our dataLayer pushes `debug_mode: 1` on every event when this flag is present (sticky for the session). Within ~30s the events should appear in GA4 → **Admin → DebugView**.
   - If they show in DebugView but **not** in Realtime/Reports, the property has a **filter** dropping them. Most often this is the "Internal traffic" filter excluding office/VPN IPs in Admin → Data Streams → web stream → Configure tag settings → Define internal traffic.
   - If they don't show in DebugView either, the server container's GA4 tag is publishing to the **wrong measurement ID** (re-check step 5).

### D. Confirm server-side conversion events are flowing

Server-side `Purchase`, `CompleteRegistration`, `Lead`, etc. are independent from the browser flow.

8. In the API/worker production env, all four of these must be set (any missing var disables the entire pipeline — see `apps/api/src/lib/marketing-events-enabled.ts`):

   - `SGTM_ENDPOINT_URL` = `https://gtm.lax.bid`
   - `GA4_MEASUREMENT_ID` = `G-GDG4D2YELR` *(this is GitHub repo **variable** `GA4_MEASUREMENT_ID`, not a secret)*
   - `META_PIXEL_ID`
   - `META_CAPI_ACCESS_TOKEN`

9. Inspect the `marketing_event_outbox` table:

   ```sql
   select state, count(*), max(last_error)
   from marketing_event_outbox
   where created_at > now() - interval '1 day'
   group by 1 order by 1;
   ```

   - All `sent` → working.
   - `failed` rows → `last_error` tells you why (`sgtm_http_404`, `meta_capi_invalid_token`, etc.).
   - `pending` rows piling up → worker is not consuming the queue.

### E. Last-resort: the GTM container ID baked into the build is wrong

10. View source on `https://lax.bid` after accepting the banner. Search for `GTM-`. The value rendered must equal the container that's actually configured in GTM and pointed at `gtm.lax.bid`. If the prod build was deployed without the `vars.NEXT_PUBLIC_GTM_ID` GitHub Actions variable set (it's a **repo variable**, not a secret — set under repo Settings → Variables → Actions), the source will not contain any `GTM-…` string at all and **no** browser tracking can fire.

---

## 12. Pre-launch testing toggle (TEMPORARY)

Before public launch, marketing and engineering can bypass the cookie banner on **test/staging** so GA4, GTM, and Meta CAPI validation does not require clicking "Accept all" on every session.

| GitHub repo variable | Value |
|---|---|
| `NEXT_PUBLIC_DISABLE_CONSENT_BANNER` | `true` on test; **`false` or unset on prod** |

When `"true"`:

- The banner does not render.
- Analytics and marketing consent are treated as granted from the first page load.
- Browser dataLayer events and server-side CAPI/GA4 events flow end-to-end (consent headers are also granted).

**This must be turned off before go-live.** Leaving it enabled in production violates UK GDPR/PECR consent requirements. Pre-launch checklist:

- [ ] Set `NEXT_PUBLIC_DISABLE_CONSENT_BANNER=false` in prod GitHub vars and re-apply Terraform (ephemeral).
- [ ] Verify in an incognito window on prod that the banner appears again.
- [ ] Remove all `TEMPORARY` code paths and the env var from Terraform (follow-up issue).

Re-apply test/prod ephemeral Terraform after changing the variable (`Terraform apply test` / `Terraform apply prod` workflows).

---

## 13. Common questions

**"I added a tag in GTM but nothing's happening."**
Did you publish the container? GTM containers must be **published** (not just saved) before changes go live. Also confirm the visitor has accepted the right consent category (Analytics for measurement tags, Marketing for ad tags).

**"My conversion event isn't showing up in Meta."**
Three things to check, in order:
1. Did the visitor accept **Marketing** consent? If not, only the legitimate-interest conversions (`Purchase`, `CompleteRegistration`) will fire.
2. Is the event in Meta's **Test events** view? If yes, the data is reaching Meta; you're looking at a Meta-side delay or attribution issue.
3. Check the `marketing_event_outbox` database table (ask a developer) — if the row shows `state='failed'` there will be an error message explaining what Meta rejected.

**"Why is Marketing greyed out in the cookie preferences?"**
Because Analytics is off. GTM is what runs marketing tags, so without Analytics there's no runtime. Turn Analytics on first.

**"Can I track events without GTM?"**
No, and this is intentional. Everything routes through GTM so we have one place to apply consent, dedupe, and audit. Direct vendor SDKs in our codebase would bypass that.

**"What changes if I move gtm.lax.bid to a different host?"**
Nothing in our codebase — the app references the hostname, not the host. The marketing setup (containers, GA4, Meta IDs) stays identical. Only DNS and the sub-processor list in our DPIA need updating.

**"How do I see my own visit in GA4 quickly?"**
Append `?gtm_debug=1` to any URL on `lax.bid`. The flag is sticky for the rest of the session — every event the page fires after that includes `debug_mode: 1` and shows up under GA4 → Admin → DebugView within ~30 seconds.
