# V1 Product Specification

Updated: 2026-05-05

## Purpose

This document defines the V1 target product rules and scope.
It is normative for V1 planning and implementation.

`docs/SYSTEM_ANALYSIS.md` describes the current auction-domain runtime.
`docs/architecture/01-overview.md` describes the platform architecture.
If there is a mismatch with this spec, V1 implementation work should be planned
to close the gap.

## V1 Role Model

V1 has three user role types:

1. **administrator**
   - Full read/write access across the platform.
   - Can manage auctions, lots, users, roles, invitations, submissions, and finance.

2. **accountant**
   - Finance-only administrative scope.
   - Can access payments, invoices, accounting sync/status, and finance reporting.
   - Cannot manage auctions, lots lifecycle, strategy policy, or general user administration outside finance scope.

3. **client**
   - Standard marketplace account.
   - A single client account can act as buyer, seller, or both depending on actions.

## Identity And Artwork Ownership Rules

### Client Buyer/Seller Behavior

- The same client identity can place bids (buyer role in context) and submit/manage artworks (seller role in context).
- No separate buyer-only or seller-only account type is required in V1.

### Catalogue Artist Assignment

The catalogue identity attached to a lot — artist / maker / brand / marque — is
an admin-curated entity (`artist_profile`) that is **decoupled from the
consigning user**. Signing up as a client never creates an artist record.

- The submitter (consignor) becomes the **seller** of the resulting lot, but
  not automatically its catalogue artist.
- When admin approves a submission, the approval payload accepts either an
  existing `artistId` or an inline `newArtist` (admin-driven creation,
  defaulted to `approved`). The resolved artist id is written to
  `lot.artist_id` (FK to `artist_profile`).
- Admin can change a lot's `artistId` later from the admin lot edit screen via
  the shared `<ArtistPicker />` (search-and-pick or inline create).
- Catalogue artist creation itself (`POST /artists`) is admin-only, gated by
  the `artist.review` capability. The legacy
  Attribution is stored only on `lot.artist_id` (FK to `artist_profile`).

## Invitations

- Admin can invite **staff and clients**.
- Invite workflow supports role assignment during onboarding for:
  - administrator
  - accountant
  - client

## Auction Policy (V1)

### Strategy Support

- V1 supports **English auction strategy only** for product-facing auction flows.
- Other strategy types that exist in schema/code are out of V1 scope and should be hidden or disabled in V1 product flows.

### Sale Delivery Modes

1. **online**
   - Fully interactive mode.
   - Clients can bid and perform all normal online auction interactions.

2. **onsite**
   - Marketing/read-only for bidding.
   - Clients can browse sale/lot details.
   - Clients can follow/watch/register interest style interactions.
   - Bidding is not allowed.
   - The lot-page **In-Person Event Participation Hub** (paddle / absentee /
     telephone / stream cards) is **hidden in V1**. That placement shows the
     always-open **LOT DETAILS** block instead. Telephone line requests remain
     available on the **sale** participate section where configured.

## V1 Functional Requirements

- **V1-FR-001**: System must enforce the V1 role model (`administrator`, `accountant`, `client`) in authz and UI behavior.
- **V1-FR-002**: Accountant permissions must be restricted to finance domains.
- **V1-FR-003**: Client accounts must support both buyer and seller actions from a single identity.
- **V1-FR-004**: On submission approval, admin must explicitly select or
  inline-create a catalogue artist (`artist_profile`); the resulting lot's
  `artist_id` FK and seller (consignor) are tracked independently.
- **V1-FR-005**: Admin invitation workflows must support role-based onboarding for staff and clients.
- **V1-FR-006**: V1 auction interactions must expose English strategy only.
- **V1-FR-007**: Online and onsite behavior must be consistently enforced in backend and frontend.
- **V1-FR-008**: Onsite bidding must remain blocked while allowing non-bid engagement interactions.
- **V1-FR-009**: Onsite/hybrid lot pages must not surface the In-Person Event Participation Hub in V1; show LOT DETAILS in that region instead.

## Acceptance Criteria

- **V1-AC-001**: Role matrix is implemented and testable for all protected areas.
- **V1-AC-002**: Accountant cannot perform non-finance admin actions.
- **V1-AC-003**: A client can submit an artwork; approval requires admin to
  pick or inline-create a catalogue artist before the submission converts to
  a lot.
- **V1-AC-004**: Admin can change a lot's catalogue artist (`lot.artist_id`)
  after approval via the admin lot edit screen.
- **V1-AC-005**: Admin can send invitations with target role selection for accountant/admin/client.
- **V1-AC-006**: V1 user flows cannot create/use non-English auction strategy paths.
- **V1-AC-007**: Online sale lots allow bidding; onsite sale lots reject bidding.
- **V1-AC-008**: Onsite lots still allow defined non-bid interactions (follow/watch/interest) where available.
- **V1-AC-009**: Onsite/hybrid lot pages render LOT DETAILS (not the participation hub) and do not expose absentee/telephone hub CTAs on the lot timeline.

## Explicit V1 Out Of Scope

- Full product support for Dutch, sealed, and buy-it-now auction strategies.
- Multi-role enterprise permission system beyond the three V1 role types.
- Invitation workflows beyond role-based onboarding for staff/clients.
- Lot-page In-Person Event Participation Hub (absentee bid mailto form, per-lot
  telephone request cards, and related timeline anchor CTAs). Sale-level telephone
  booking panel may remain where product needs it.

## Known Gaps To Close (Current vs Target)

- The role model has `administrator`, `accountant`, and `client` as first-class
  roles in `packages/types/src/role-policy.ts`; verify V1 admin and accountant
  UI surfaces match the role matrix.
- Invitation workflows exist (`apps/api/src/routes/admin-invitations.ts`,
  `apps/web/src/app/admin/(platform)/invitations/`); verify each role is
  reachable from the admin invitation flow.
- Multiple auction strategies (`english`, `dutch`, `sealed`, `buy_it_now`)
  exist in code/schema. V1 product flows must hide non-English strategies.
- Onsite non-bid engagement (follow/watch) behavior must be confirmed as
  consistent in API + UI.
