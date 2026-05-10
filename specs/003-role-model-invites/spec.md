# Feature Specification: Role Model And Invitations (V1)

**Feature Branch**: `003-role-model-invites`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "V1 role model and invitation implementation"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Enforce V1 Role Access (Priority: P1)

As a system administrator, I need role-based authorization for `administrator`, `accountant`, and `client` so users can access only allowed capabilities.

**Why this priority**: Role access is a blocking security and operational requirement for all V1 features.

**Independent Test**: Role-gated API routes and UI actions are validated with role-specific tests and access matrix checks.

**Acceptance Scenarios**:

1. **Given** an accountant user, **When** attempting non-finance admin actions, **Then** access is denied.
2. **Given** an administrator user, **When** using admin management features, **Then** full access is granted.
3. **Given** a client user, **When** accessing client auction flows, **Then** access is granted without staff permissions.

---

### User Story 2 - Invite Users With Role Assignment (Priority: P1)

As an administrator, I need to invite staff and clients with explicit role assignment so onboarding is controlled and auditable.

**Why this priority**: V1 staffing and user growth require invitation-based onboarding with correct permissions at account creation.

**Independent Test**: Invitation creation, acceptance, and final role assignment can be tested end-to-end.

**Acceptance Scenarios**:

1. **Given** an admin inviter, **When** creating an invite with role `accountant`, **Then** invite metadata stores role target.
2. **Given** a valid invitation link, **When** invitee signs up, **Then** resulting account has the invited role.
3. **Given** an expired invite token, **When** used for signup, **Then** signup is rejected with a clear error.

---

### User Story 3 - Keep One Client Identity For Buy/Sell (Priority: P2)

As a client, I need one account that can act as both buyer and seller so I can participate in both sides of auctions.

**Why this priority**: This is a core V1 product rule and affects both submission and bidding behavior.

**Independent Test**: A client account can submit artwork and place bids in permitted flows using the same identity.

**Acceptance Scenarios**:

1. **Given** an approved client submission, **When** the lot is generated, **Then** submitter is recorded as the lot's seller (consignor) and admin's chosen `artist_profile` (existing or inline-created via the approval payload) is recorded on `lot.artist_id`.
2. **Given** an existing lot, **When** admin updates `lot.artist_id` from the admin lot edit screen via the `<ArtistPicker />`, **Then** catalogue attribution updates without changing the seller.

---

### User Story 4 - Align V1 Policy With Existing System Constraints (Priority: P2)

As a developer, I need explicit handling rules for existing non-V1 states (legacy roles/strategy values) so rollout is predictable.

**Why this priority**: Current schema/code includes non-English auction strategies and role gaps; rollout needs defined migration behavior.

**Independent Test**: Policy enforcement tests verify unsupported states are blocked/hidden in V1 flows.

**Acceptance Scenarios**:

1. **Given** non-English strategy values in existing data, **When** V1 UI/admin creation flows are used, **Then** only English is exposed.
2. **Given** legacy role data, **When** authz checks run, **Then** unmapped roles are denied or mapped per migration policy.

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens to existing users if role migration to `accountant` is incomplete?
- How are invitations invalidated when inviter role changes or account is disabled?
- How are legacy lots with non-English strategy surfaced in V1 UI?
- What happens if catalogue artist (`lot.artist_id`) reassignment occurs after active bidding has started?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST support role types `administrator`, `accountant`, and `client`.
- **FR-002**: Accountant role MUST be restricted to finance domains (payments, invoices, accounting operations/reports).
- **FR-003**: Administrator role MUST retain full platform access.
- **FR-004**: Client role MUST support both buyer and seller actions from one account.
- **FR-005**: System MUST provide admin-controlled invitation flow with target role assignment.
- **FR-006**: Invitation acceptance MUST create account with invited role and preserve invitation audit metadata.
- **FR-007**: System MUST reject expired, invalid, and reused invitation tokens.
- **FR-008**: Submission approval MUST require an explicit catalogue artist
  decision (`{ artistId } | { newArtist }`) — submitters never auto-promote
  to a catalogue artist. Catalogue artist creation is admin-only via
  `POST /artists` (capability `artist.review`); the resolved id is written to
  `lot.artist_id` (FK to `artist_profile`).
- **FR-009**: Product-facing V1 flows MUST expose English strategy only.
- **FR-010**: Authorization and invitation logic MUST be covered by automated tests.

### Key Entities *(include if feature involves data)*

- **UserRole**: Role assignment for `administrator`, `accountant`, and `client`.
- **Invitation**: Role-targeted onboarding token and status lifecycle.
- **UserPermissionScope**: Authorization boundaries for finance, admin, and client features.
- **ArtistProfile**: Admin-curated catalogue identity (`artist | maker | brand | marque`) with admin lifecycle (`pending | approved | rejected | merged_into`). Decoupled from the consigning user.
- **LotArtistLink**: `lot.artist_id` FK to `artist_profile.id` — canonical catalogue link, set/changed only via admin flows.

## SOLID Impact *(mandatory for code-affecting features)*

<!--
  ACTION REQUIRED: Explain how the proposed feature preserves SOLID principles.
  If any principle is intentionally bent, document rationale and mitigation.
-->

- **S (Single Responsibility)**: Separate invitation lifecycle, role policy, and feature authz checks into dedicated modules.
- **O (Open/Closed)**: Add role-policy handlers via composable authorization guards instead of hardcoding checks across routes.
- **L (Liskov Substitution)**: Ensure authz service implementations preserve shared interface behavior across API and test adapters.
- **I (Interface Segregation)**: Keep finance-role interfaces separate from general admin/user management interfaces.
- **D (Dependency Inversion)**: Route and service layers depend on role/authz abstractions, with repositories/adapters injected.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of protected test routes/actions enforce role matrix as specified for admin/accountant/client.
- **SC-002**: Invitation flow supports all three V1 roles with token validation and audited acceptance.
- **SC-003**: A single client account can complete both submission (seller path) and bidding (buyer path) in tests.
- **SC-004**: V1 creation/configuration flows do not expose non-English auction strategy options.

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- Existing authentication/session infrastructure remains in use and is extended for V1 role needs.
- Invitation delivery channel (email/link) can be implemented using existing infrastructure or equivalent.
- Existing users/roles can be migrated safely to V1 role matrix.
- This feature focuses on role/invite enforcement and does not replace existing bidding core logic.
