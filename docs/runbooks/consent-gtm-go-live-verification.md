# Consent + GTM go-live verification

Run this checklist on **production** (`https://lax.bid`) before public launch and after any consent/GTM deploy.

## Prerequisites

- `NEXT_PUBLIC_GTM_ID` is set in the prod GitHub repo variable and baked into the web build (`GTM-W6K4N67Z`).
- The temporary `NEXT_PUBLIC_DISABLE_CONSENT_BANNER` bypass has been removed from code and Terraform.
- sGTM endpoint is healthy:

```bash
curl -sS -o /dev/null -w "gtm.lax.bid/healthy -> HTTP %{http_code}\n" https://gtm.lax.bid/healthy
# Expect: HTTP 200
```

## A. Banner visible (incognito)

1. Open a **private/incognito** window to `https://lax.bid`.
2. Confirm the **Cookies on LAX.BID** banner shows **Customise** (outline) and **Accept all** (primary) on the first layer — **Reject all** is not on the banner.
3. Confirm **Accept all** is the filled primary button and **Customise** opens the cookie preferences dialog.

## B. Before any choice (expect silence)

With the banner showing and nothing clicked:

| Check | Expected |
|-------|----------|
| DevTools → Network → filter `googletagmanager` | No `gtm.js` request |
| DevTools → Network → filter `gtm.lax.bid` | No requests |
| Console → `window.dataLayer` | Contains `consent` default with `denied` states |

This is correct and compliant (Basic Consent Mode).

## C. After **Accept all**

1. Click **Accept all**.
2. Banner should dismiss.

| Check | Expected |
|-------|----------|
| Network → `googletagmanager` | `gtm.js?id=GTM-W6K4N67Z` loads (200) |
| Network → `gtm.lax.bid` | `g/collect` or similar GA4 hits (200/204) |
| Console → `window.dataLayer` | `consent` update with `analytics_storage: "granted"` |
| GA4 DebugView (optional) | `page_view` appears when `?debug_mode=1` is used |

## D. After **Reject all** (fresh incognito session)

1. Open a new incognito window.
2. Click **Customise**.
3. Click **Reject all**.

| Check | Expected |
|-------|----------|
| Network → `googletagmanager` | No `gtm.js` |
| Network → `gtm.lax.bid` | No requests |
| Cookie `lax_consent` | `analytics: false`, `marketing: false` |

## E. GTM container configuration (marketing team)

In the **web container** (`GTM-W6K4N67Z`):

- GA4 Configuration tag: `transport_url = https://gtm.lax.bid`, `first_party_collection = true`.
- GA4 and ad tags require the appropriate Consent Mode signals (`analytics_storage`, `ad_storage`, etc.) — not `NOT_NEEDED`.

In the **server container** (`GTM-575HV8LQ`):

- Server container URL: `https://gtm.lax.bid`.
- GA4 Client + Meta CAPI tag published (not draft-only).

Validate with [Google Tag Assistant](https://tagassistant.google.com/) or Stape preview before relying on live data.

## F. Policy alignment

Confirm public pages match the deployed stack:

- [`/cookies`](https://lax.bid/cookies) — GTM, GA4, `gtm.lax.bid`, Consent Mode, banner controls.
- [`/privacy`](https://lax.bid/privacy) — server-side GTM, Meta CAPI, legitimate-interest server events.
- [`docs/privacy/dpia-meta-capi.md`](../privacy/dpia-meta-capi.md) — sub-processors and processing bases current.

## Sign-off

| Role | Name | Date | Pass |
|------|------|------|------|
| Engineering | | | |
| Marketing | | | |
| Legal / DPO | | | |
