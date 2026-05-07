# Dashboard UX Roadmap

This roadmap translates `docs/design/dashboard-ux-audit.md` into phased, reviewable work. It keeps the existing RBAC model: `administrator`, `accountant`, and `client`. Artist remains a client-side seller/profile mode, not a fourth role.

KYC and identity verification are intentionally out of scope.

## Roadmap Principles

- **Unlock staff operations before polish.** Admins need categories, artists, seller assignment, and payouts before advanced personalization.
- **Do not split artist into a role.** Build artist UX as a profile and workspace inside the client account, aligned with the audit's [mode-switch recommendation](dashboard-ux-audit.md#61-mode-switch-ux-recommendation).
- **Prefer durable workflows over isolated forms.** Creation screens should include preview, validation, ownership, audit trail, and follow-up actions.
- **Keep accountant work operational.** Finance needs payout, reconciliation, Xero exception, refund, and tax flows, not only read-only payment lists.
- **Treat auditability as infrastructure.** Domain event, webhook, email, and Xero logs should be visible to staff before scale.

## Phase 0 — Foundations

Target: 1-2 weeks. This phase removes the biggest daily blockers from catalog setup and client account basics.

### 0.1 Admin Categories CRUD

Audit links: [Categories](dashboard-ux-audit.md#44-categories), [Sale Creation](dashboard-ux-audit.md#sale-creation), [Lot Creation](dashboard-ux-audit.md#lot-creation).

Deliverables:

- Add an admin Categories section with tree view.
- Support create, edit, archive/delete, parent selection, slug generation, and usage count.
- Add API support for create/update/delete/archive.
- Keep the first data model small if needed: name, slug, parent, archived flag, sort order.

Acceptance signals:

- Admin can create a new category without using a database console.
- Admin can assign the category to a sale or lot from a searchable picker.
- Delete/archive warns when a category is used by lots, sales, or submissions.

### 0.2 Replace Raw Category Inputs

Audit links: [Sales](dashboard-ux-audit.md#42-sales), [Lots](dashboard-ux-audit.md#43-lots), [Submissions](dashboard-ux-audit.md#46-submissions).

Deliverables:

- Replace raw category UUID entry in lot and sale admin forms with a tree/search picker.
- Add the same picker to submission create/edit where possible.
- Show category breadcrumb in tables and detail pages.

Acceptance signals:

- No catalog-facing form asks non-technical admins to paste a category UUID.
- Invalid/missing category states are handled before submit.

### 0.3 Seller Picker On Lot Create

Audit links: [Lots](dashboard-ux-audit.md#43-lots), [Lot Creation](dashboard-ux-audit.md#lot-creation).

Deliverables:

- Add seller search/picker to admin lot create/edit.
- Search by name, email, seller history, and submission ID.
- Default from converted submission when lot is created from a submission.

Acceptance signals:

- Admin can create a lot for a seller without relying on server default behavior.
- Lot detail clearly shows seller identity and source submission if applicable.

### 0.4 Client Settings Basics

Audit links: [Buying Mode](dashboard-ux-audit.md#62-buying-mode), [Shared Client Settings](dashboard-ux-audit.md#64-shared-client-settings), [Address](dashboard-ux-audit.md#address).

Deliverables:

- Surface address book in dashboard settings.
- Add checkout address picker.
- Add payment methods placeholder or integration surface if payment methods are not yet available.
- Keep KYC out of this scope.

Acceptance signals:

- Client can add/edit/delete addresses from settings.
- Checkout can use a saved address.

## Phase 1 — Admin Core Completeness

Target: after Phase 0. This phase makes admin usable for real auction preparation and production support.

### 1.1 Artist Profiles And Attribution

Audit links: [Artists](dashboard-ux-audit.md#45-artists), [Artist Creation](dashboard-ux-audit.md#artist-creation), [Selling & Artist Mode](dashboard-ux-audit.md#63-selling--artist-mode).

Deliverables:

- Define first-class artist profile storage or a clear user-profile extension.
- Add admin Artists section with list, create, edit, merge, archive, and featured controls.
- Add claim/link-to-client-user flow.
- Add attribution approval queue for seller/artist claims.
- Connect lot artist picker to the profile model.

Acceptance signals:

- Admin can create "Marcus Veil" as a public artist profile without creating a new RBAC role.
- Admin can link a client user to an artist profile when appropriate.
- Lots can display a canonical artist profile independent of seller account copy.

### 1.2 Lot Create/Edit Upgrade

Audit links: [Lots](dashboard-ux-audit.md#43-lots), [Lot Creation](dashboard-ux-audit.md#lot-creation), [Lot Marketing](dashboard-ux-audit.md#lot-marketing).

Deliverables:

- Add image manager with primary image, order, alt text, captions, and upload status.
- Add public-card preview and lot detail preview.
- Add clone/duplicate lot.
- Add fee, reserve, and increment preview.
- Add marketing details UI for estimate, condition report, provenance, exhibitions, and artist note.
- Add shipping/certificate fields or document as schema backlog if not implemented in this phase.

Acceptance signals:

- Admin can prepare a publishable lot without editing JSON manually.
- Admin can preview how the lot appears publicly before publish.
- Admin can duplicate a similar lot and adjust only changed fields.

### 1.3 Submission Review Workflow

Audit links: [Submissions](dashboard-ux-audit.md#46-submissions), [Submission Creation](dashboard-ux-audit.md#submission-creation).

Deliverables:

- Add specialist/owner assignment.
- Add request-more-information thread with attachment requests.
- Add estimate/reserve proposal and acceptance flow.
- Add conversion preview before creating a draft lot.
- Add batch actions for review queues.
- Add digital consignment agreement status or placeholder.

Acceptance signals:

- Admin can move a submission through review without external email.
- Seller can see what is needed next and why.
- Converted lot preserves source submission and seller context.

### 1.4 User Detail Page

Audit links: [Users](dashboard-ux-audit.md#47-users), [User / Invitation](dashboard-ux-audit.md#user--invitation).

Deliverables:

- Replace or supplement drawer with a full user detail page.
- Show profile, role, email status, suspension history, addresses, bids, won lots, submissions, payments, watchlist, artist follows, and notes.
- Add suspension reason form and audit trail.
- Add paddle/sale registration and credit decision placeholders without identity verification.

Acceptance signals:

- Staff can investigate a user without jumping through unrelated pages.
- Suspension/unsuspension always records a reason.

### 1.5 Operational Log Viewers

Audit links: [Domain Events / Audit](dashboard-ux-audit.md#414-domain-events--audit), [Webhook Logs](dashboard-ux-audit.md#415-webhook-logs), [Email](dashboard-ux-audit.md#410-email), [Xero](dashboard-ux-audit.md#52-xero).

Deliverables:

- Add domain event viewer with filters by aggregate, event type, actor, date, and correlation ID.
- Add webhook log viewer for generic and Xero webhooks.
- Link logs from record timelines.
- Add email event drill-down from outbox rows.

Acceptance signals:

- Staff can answer "what happened to this lot/payment/submission?" from admin UI.
- Failed webhooks and failed emails are visible without direct DB access.

### 1.6 System Settings

Audit links: [System Settings](dashboard-ux-audit.md#413-system-settings), [Cross-Cutting Gaps](dashboard-ux-audit.md#3-cross-cutting-gaps).

Deliverables:

- Add settings shell for platform defaults.
- Include buyer premium default, display timezone, default currency/display currency policy, upload limits, feature flags, email/payment provider health, and terms revision tracking.
- Defer complex tax and multi-currency behavior to later phases if needed.

Acceptance signals:

- Operators can see current platform defaults.
- Changes are audited and guarded.

## Phase 2 — Client Mode-Switch And Seller Surface

Target: after admin foundations are usable. This phase turns the client account into a coherent buyer/seller/artist workspace.

### 2.1 Client Workspace Switcher

Audit links: [Mode-Switch UX Recommendation](dashboard-ux-audit.md#61-mode-switch-ux-recommendation), [Client Audit](dashboard-ux-audit.md#6-client-audit).

Deliverables:

- Add desktop sidebar switcher: Buying / Selling & Artist.
- Add mobile account-sheet switcher.
- Persist selected workspace.
- Keep notifications, support, search, and settings shared.
- Add empty seller onboarding when the client has never submitted.

Acceptance signals:

- A buyer can switch into selling without a second login or new role.
- A seller can switch back to bidding without losing context.

### 2.2 Seller Overview

Audit links: [Selling & Artist Mode](dashboard-ux-audit.md#63-selling--artist-mode).

Deliverables:

- Add overview cards for drafts, submitted items, review items, in-sale items, sold items, payout due, and messages needing reply.
- Add "continue submission" and "view sold lots" calls to action.
- Add artist profile completeness card if artist opt-in is enabled.

Acceptance signals:

- Seller can understand their end-to-end state in under one screen.

### 2.3 Submissions Expansion

Audit links: [Selling & Artist Mode](dashboard-ux-audit.md#63-selling--artist-mode), [Submission Creation](dashboard-ux-audit.md#submission-creation).

Deliverables:

- Expand submission form with year, signature, edition, provenance, exhibition history, condition, certificate upload, packed dimensions, weight, video link, and valuation expectations.
- Add draft quality checklist.
- Add "copy previous submission".
- Keep required fields conservative to avoid blocking first-time sellers.

Acceptance signals:

- Seller can provide enough information for a specialist to make a decision without immediate back-and-forth.

### 2.4 My Items In Sale

Audit links: [Selling & Artist Mode](dashboard-ux-audit.md#63-selling--artist-mode).

Deliverables:

- Add seller-facing list of lots created from their submissions.
- Show sale, lot status, current bid, reserve met indicator, closing time, watch count, and public link.
- Avoid exposing private bidder identity.

Acceptance signals:

- Seller can track live or scheduled lots without an admin account.

### 2.5 Sold & Payouts

Audit links: [Seller Payouts](dashboard-ux-audit.md#53-seller-payouts), [Sold & Payouts](dashboard-ux-audit.md#63-selling--artist-mode).

Deliverables:

- Add seller-facing sold lots and payout status.
- Show hammer, seller fees, adjustments, net payout, hold reason, expected date, and statement link.
- Coordinate with accountant payout model in Phase 4 if payout backend is not ready.

Acceptance signals:

- Seller can answer "what sold, how much will I receive, and when?" from the dashboard.

### 2.6 Artist Profile Editor

Audit links: [Artists](dashboard-ux-audit.md#45-artists), [Artist Profile](dashboard-ux-audit.md#63-selling--artist-mode).

Deliverables:

- Add client opt-in: "I am the artist of works I sell."
- Add artist profile editor for display name, portrait, bio, statement, links, CV/exhibitions, awards, and preview.
- Add request-to-feature flow.
- Route attribution changes through admin approval when needed.

Acceptance signals:

- A client artist can maintain a public profile without becoming a new RBAC role.

### 2.7 Buyer Checkout Improvements

Audit links: [Buying Mode](dashboard-ux-audit.md#62-buying-mode), [Payment / Payout](dashboard-ux-audit.md#payment--payout).

Deliverables:

- Add multi-lot checkout.
- Add saved payment method UI if supported.
- Add invoice/receipt download.
- Add shipping/collection scheduling.
- Add resale-on-LAX shortcut from collection.

Acceptance signals:

- A buyer with multiple won lots can complete payment and logistics without repeating the same flow per lot.

## Phase 3 — Live Sale

Target: after core catalog and client flows are stable. This phase supports live/onsite auction operations and client live bidding.

### 3.1 Paddle / Sale Registration

Audit links: [Buying Mode](dashboard-ux-audit.md#62-buying-mode), [Users](dashboard-ux-audit.md#47-users).

Deliverables:

- Add sale registration request from public sale page and client dashboard.
- Add admin approval queue with reason capture.
- Add paddle number assignment.
- Add bidder status surfaced in client dashboard and saleroom.
- Keep identity verification out of scope.

Acceptance signals:

- A client can request approval to bid in a sale.
- Admin can approve, decline, or revoke sale bidding access with audit history.

### 3.2 Live Saleroom Console

Audit links: [Live Saleroom Console](dashboard-ux-audit.md#411-live-saleroom-console).

Deliverables:

- Add admin/clerk console for current lot, next lot, lot queue, bid history, reserve status, and operator actions.
- Support manual bid entry with source: floor, phone, absentee, online.
- Support hammer, pass, withdraw, re-open, undo last action, and broadcast message.
- Add keyboard shortcuts and high-contrast auctioneer display mode.

Acceptance signals:

- A clerk can run an onsite/live sale from the platform.
- Every action is auditable.

### 3.3 Live Bidder View

Audit links: [Buying Mode](dashboard-ux-audit.md#62-buying-mode).

Deliverables:

- Add client live sale screen with current lot, current ask, next bid, countdown, stream, paddle status, and confirmation.
- Add absentee/max bid integration where supported.
- Add clear outbid/winning/sold feedback.

Acceptance signals:

- A registered client can follow and bid in a live sale from the web app.

## Phase 4 — Reporting, Finance, Communications, Content

Target: once auction operations are active and staff need scalable back-office tools.

### 4.1 Accountant Seller Payouts

Audit links: [Seller Payouts](dashboard-ux-audit.md#53-seller-payouts), [Payment / Payout](dashboard-ux-audit.md#payment--payout).

Deliverables:

- Add payout batches, seller statements, hold/release workflow, payment status, and statement PDF export.
- Add accountant filters by seller, sale, status, amount, and period.
- Add bulk mark-paid and adjustment entries.

Acceptance signals:

- Accountant can prepare and track seller payouts from admin.
- Seller-facing payout status has a reliable source.

### 4.2 Tax / VAT Reporting

Audit links: [Tax / VAT](dashboard-ux-audit.md#54-tax--vat), [Reports](dashboard-ux-audit.md#55-reports).

Deliverables:

- Add tax/VAT settings and report exports.
- Add tax code mapping for Xero.
- Add period reports for GMV, fees, refunds, seller payouts, and tax due.

Acceptance signals:

- Finance can close a period without custom DB queries.

### 4.3 Xero And Payment Exception Handling

Audit links: [Payments](dashboard-ux-audit.md#51-payments), [Xero](dashboard-ux-audit.md#52-xero).

Deliverables:

- Add failed sync queue.
- Add retry and error detail.
- Add invoice preview/copy link.
- Add reconciliation status.
- Add capture/refund reason fields and partial refund flow where gateway supports it.

Acceptance signals:

- Accountant can resolve payment and Xero issues without developer help.

### 4.4 Email And Campaign Operations

Audit links: [Email](dashboard-ux-audit.md#410-email).

Deliverables:

- Add email template preview and test send.
- Add campaign/newsletter composer.
- Add segment builder based on watchlist, artist follows, sale follows, categories, and past bidding.
- Add bounce/complaint remediation.

Acceptance signals:

- Staff can send and verify key lifecycle emails safely.

### 4.5 Admin CMS

Audit links: [Content Management](dashboard-ux-audit.md#412-content-management).

Deliverables:

- Add editable pages for About, FAQ, Terms, Privacy, Shipping, Contact.
- Add homepage hero, featured sale, featured artist, and banner controls.
- Add draft/preview/publish.
- Add structured-data overrides where needed.

Acceptance signals:

- Marketing/content changes no longer require code edits for routine updates.

## Phase 5 — Polish And Power Tools

Target: after the platform operates end-to-end.

### 5.1 Search, Saved Views, And Bulk Ops

Audit links: [Cross-Cutting Gaps](dashboard-ux-audit.md#3-cross-cutting-gaps).

Deliverables:

- Ensure command palette searches records, not just routes.
- Add saved admin views.
- Add bulk actions across lots, submissions, users, invitations, payments, and email suppressions.

### 5.2 Mobile And Responsive Improvements

Audit links: [Cross-Cutting Gaps](dashboard-ux-audit.md#3-cross-cutting-gaps).

Deliverables:

- Add mobile-safe admin emergency flows.
- Add responsive client seller mode.
- Add improved table/card transforms on smaller screens.

### 5.3 Onboarding And Empty States

Audit links: [Mode-Switch UX Recommendation](dashboard-ux-audit.md#61-mode-switch-ux-recommendation), [Cross-Cutting Gaps](dashboard-ux-audit.md#3-cross-cutting-gaps).

Deliverables:

- First-run buyer onboarding.
- First-run seller onboarding.
- Admin setup checklist.
- Empty states for categories, artists, sales, lots, submissions, payments, watchlist, and payouts.

### 5.4 Preferences And Personalization

Audit links: [Shared Client Settings](dashboard-ux-audit.md#64-shared-client-settings).

Deliverables:

- Display currency preference.
- Display timezone preference.
- Notification presets.
- Dashboard density and saved layout preferences.

### 5.5 Advanced Analytics

Audit links: [Analytics](dashboard-ux-audit.md#49-analytics).

Deliverables:

- Per-sale, per-category, per-artist, and per-seller analytics.
- Reserve performance.
- Estimate accuracy.
- Funnel analytics.
- Scheduled reports.

## Cross-Cutting Schema Backlog

These are implied by the audit and roadmap. They should be designed in specs before implementation.

- **Artist profile model:** canonical artist profile, slug, bio, portrait, owner user link, featured flag, merge history.
- **Category expansion:** archived flag, sort order, description, SEO metadata, default premium/increment rules.
- **Payment lifecycle:** `updatedAt`, status-change timestamps, refund reason, partial refund records, dispute state, reconciliation status.
- **Payout model:** payout batch, seller statement, adjustment, payout status, payout method status.
- **Sale registration:** sale registration, paddle number, approval state, decision reason, audit trail.
- **Live sale state:** bid source, clerk action log, passed/withdrawn/reopened semantics.
- **Submission workflow:** specialist assignment, message thread, requested files, estimate/reserve proposal, agreement status.
- **User operations:** notes, tags, display timezone, display currency, business/tax profile.
- **Media metadata:** primary image, captions, alt text, sort order, rejection status.

KYC and identity verification fields are excluded from this backlog.

## Suggested Milestone Order

1. Categories CRUD and category picker.
2. Seller picker and artist profile foundation.
3. Lot form upgrade and submission review workflow.
4. Client workspace switcher and seller overview.
5. Seller payouts and accountant payout operations.
6. Live sale registration, saleroom console, and live bidder view.
7. Reporting, email operations, CMS, and power tools.
