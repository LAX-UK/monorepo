# Feature Specification: V1 Product Rules

**Feature Branch**: `002-v1-product-rules`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User direction for V1 roles, identity flow, invites, and auction mode policy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Govern Access By V1 Role (Priority: P1)

As a platform administrator, I need a clear role model so each user type sees and does only what V1 permits.

**Why this priority**: Role policy is foundational for all finance, auction, and onboarding workflows.

**Independent Test**: Validate role matrix expectations for administrator, accountant, and client on representative routes/actions.

**Acceptance Scenarios**:

1. **Given** an administrator account, **When** accessing platform management features, **Then** full read/write actions are allowed.
2. **Given** an accountant account, **When** accessing non-finance administration areas, **Then** access is denied.
3. **Given** a client account, **When** using marketplace features, **Then** buyer/seller actions are available without staff privileges.

---

### User Story 2 - Support Unified Client Buyer/Seller Identity (Priority: P1)

As a client, I need one account that can buy and sell so I can participate fully without managing multiple identities.

**Why this priority**: Core marketplace behavior depends on flexible client identity.

**Independent Test**: A single client account can submit artwork and place bids where policy allows.

**Acceptance Scenarios**:

1. **Given** a client user, **When** submitting artwork and receiving approval, **Then** the submitter becomes the lot's seller (consignor) but the catalogue artist (`lot.artist_id`) is set explicitly by admin to an existing or inline-created `artist_profile`.
2. **Given** an approved submission, **When** admin changes `lot.artist_id` via the admin lot edit screen, **Then** the lot's catalogue attribution updates while seller (consignor) remains independent.
3. **Given** a client with active lots, **When** bidding on disallowed own-lot paths, **Then** normal guardrails still apply.

---

### User Story 3 - Invite Staff And Clients With Role Assignment (Priority: P2)

As an administrator, I need role-based invitations so staff and clients can onboard with the right permissions.

**Why this priority**: V1 operations require controlled staff onboarding and user growth.

**Independent Test**: Invitation flow supports administrator, accountant, and client target roles.

**Acceptance Scenarios**:

1. **Given** an admin invitation workflow, **When** selecting target role, **Then** invitation captures intended role type.
2. **Given** accepted invitation for accountant, **When** user signs in, **Then** finance-only scope is applied.

---

### User Story 4 - Enforce English-Only V1 Auction Interactions (Priority: P1)

As a product owner, I need V1 to run with English auction behavior only so launch behavior is reliable and constrained.

**Why this priority**: Reduces operational risk and complexity in early release.

**Independent Test**: Product-facing creation/configuration and bidding flows only expose English strategy.

**Acceptance Scenarios**:

1. **Given** V1 lot creation UI/API flows, **When** selecting strategy, **Then** only English is available for V1 workflows.
2. **Given** legacy non-English lots, **When** accessed in V1 flows, **Then** behavior follows explicit fallback policy (hidden/disabled by V1 product path).

---

### User Story 5 - Differentiate Online And Onsite Experiences (Priority: P1)

As a client, I need online and onsite sales to behave differently so interaction expectations are clear.

**Why this priority**: Sale mode is a core business distinction.

**Independent Test**: Online lots allow bidding; onsite lots block bidding but allow marketing engagement interactions.

**Acceptance Scenarios**:

1. **Given** an online sale lot, **When** eligible client places a valid bid, **Then** bid flow succeeds.
2. **Given** an onsite sale lot, **When** client attempts to bid, **Then** bid is rejected.
3. **Given** an onsite sale lot, **When** client uses follow/watch style interactions, **Then** interaction remains available where feature exists.

---

### Edge Cases

- Existing users with role values that do not map to new V1 role policy.
- Historic lots configured with non-English strategy.
- Invitation accepted after role policy changes.
- Catalogue artist (`lot.artist_id`) reassignment after bidding has already started.
- Onsite lots surfaced in mixed views with online lots.

## Requirements *(mandatory)*

### Functional Requirements

- **V1-FR-001**: Role model must define administrator, accountant, and client behavior.
- **V1-FR-002**: Accountant permissions must be constrained to finance domains.
- **V1-FR-003**: Client identity must support both buying and selling actions from one account.
- **V1-FR-004**: On submission approval, admin must select an existing
  `artist_profile` or inline-create a new one; the submitter automatically
  becomes the lot's seller (consignor). Catalogue artist creation is
  admin-only (`POST /artists`, capability `artist.review`).
- **V1-FR-005**: Admin invitation workflows must support staff and client role assignment.
- **V1-FR-006**: V1 auction interaction policy must be English-only.
- **V1-FR-007**: Online vs onsite behavior must be consistently enforced in backend and frontend.
- **V1-FR-008**: Onsite bidding must be blocked while non-bid engagement remains available.

### Key Entities *(include if feature involves data)*

- **UserRolePolicy**: Role matrix for administrator/accountant/client permissions.
- **ClientIdentityContext**: Buyer/seller capabilities for a single client account.
- **Invitation**: Role-targeted onboarding artifact for staff/client creation.
- **AuctionInteractionPolicy**: V1 constraints for strategy support and sale mode behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **V1-SC-001**: Role matrix is documented and test-mapped for protected product areas.
- **V1-SC-002**: Product-facing V1 flows expose English-only auction strategy.
- **V1-SC-003**: Onsite bidding denial and onsite non-bid engagement behavior are explicitly defined and testable.
- **V1-SC-004**: Submission-to-lot conversion has an explicit, admin-driven
  catalogue-artist assignment step (`{ artistId } | { newArtist }` payload) and
  later admin override on `lot.artist_id`, both testable end-to-end.

## Assumptions

- Existing implementation may require follow-up feature specs to fully match V1 target policy.
- Current analysis docs are treated as current-state references, not final target behavior.
- V1 policy specs are approved before major authz and invitation implementation changes.
