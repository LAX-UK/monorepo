# Feature Specification: Role Model And Invitations (V2 — staff \| client)

**Feature Branch**: `003-role-model-invites`  
**Created**: 2026-04-28  
**Updated**: 2026-05-11 (collapsed top-level roles)  
**Status**: Draft  
**Input**: User description: "V1 role model and invitation implementation" → evolved to `staff | client` + `user.staff_role`.

## Model

- **`user.role`**: `staff` \| `client` (DB-enforced).
- **`user.staff_role`**: required iff `role = staff`; one of `super_admin`, `auction_manager`, `catalogue_manager`, `specialist`, `finance_ops`, `operations_fulfilment`, `content_marketing`, `support_concierge`, `staff_viewer`.
- **Capabilities**: `@auction/types` `role-policy` maps `(role, staff_role)` → `RoleCapability` checks (`roleHasCapability`, `userHasAccessTo`).
- **Invitations**: `user_invitation.target_role` ∈ {`staff`,`client`}; `target_staff_role` required iff `target_role = staff`. Acceptance sets both columns on the new user.

Legacy session values `administrator` / `accountant` / `admin` normalize to `staff` for JWT/session cutover.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enforce Role + Capability Access (Priority: P1)

As platform security, I need authorization based on `staff | client` and staff capabilities so users only reach allowed APIs and admin UI.

**Independent Test**: Role-gated API routes and capability-filtered admin nav are covered by automated tests.

**Acceptance Scenarios**:

1. **Given** a `staff` user with `finance_ops`, **When** opening platform-only admin surfaces without finance or shared caps, **Then** UI omits those items and APIs return 403 where appropriate.
2. **Given** `staff` + `super_admin`, **When** using full platform admin features, **Then** access matches the capability matrix.
3. **Given** `client`, **When** using auction client flows, **Then** buyer/seller capabilities apply and staff routes are unreachable.

### User Story 2 - Invite Users With Role + Staff Role (Priority: P1)

As staff with invite rights, I need invitations that assign `client` or `staff` plus `target_staff_role` for staff invites.

**Acceptance Scenarios**:

1. **Given** an inviter, **When** creating a staff invite with `target_staff_role`, **Then** metadata stores both fields.
2. **Given** a valid invitation, **When** the invitee completes signup, **Then** the account has `role` and `staff_role` from the invitation.
3. **Given** an expired token, **When** used for signup, **Then** signup is rejected with a clear error.

### User Story 3 - One Client Identity For Buy/Sell (Priority: P2)

Unchanged: a single `client` account participates in buyer and seller journeys.

### User Story 4 - Migration & Legacy Sessions (Priority: P2)

**Acceptance**: Migration `0054_role_staff_client` backfills `staff_role` and collapses legacy `administrator` / `accountant` rows; `normalizeUserRole` maps legacy strings to `staff` / `client` at runtime.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist only `staff` and `client` as `user.role`.
- **FR-002**: System MUST persist `user.staff_role` for every staff user and MUST forbid `staff_role` on clients (DB + application).
- **FR-003**: Finance-heavy staff roles MUST be modeled via `staff_role` capabilities (e.g. `finance_ops`), not a separate top-level role.
- **FR-004**: Client role MUST support buyer and seller actions from one account.
- **FR-005**: Admin invitation flow MUST capture `target_staff_role` when `target_role = staff`.
- **FR-006**: Invitation acceptance MUST set `role` + `staff_role` and preserve invitation audit metadata.
- **FR-007**: System MUST reject expired, invalid, and reused invitation tokens.
- **FR-008**: Submission approval artist rules (unchanged from prior spec): explicit catalogue artist decision; `artist.review` / catalogue flows as implemented.
- **FR-009**: Product-facing V1 flows MUST expose English strategy only where applicable.
- **FR-010**: Authorization and invitation logic MUST be covered by automated tests.

### Key Entities

- **UserRole**: `staff` \| `client`.
- **UserStaffRole**: internal LAX staff job function; drives capabilities.
- **Invitation**: `target_role`, optional `target_staff_role`, token lifecycle.
- **ArtistProfile / LotArtistLink**: unchanged from prior spec.

## Success Criteria *(mandatory)*

- **SC-001**: Protected routes and admin UI respect the capability matrix for representative `staff_role` values.
- **SC-002**: Invitation flow supports `staff` (with `target_staff_role`) and `client` with token validation and audited acceptance.
- **SC-003**: A single `client` account can complete submission and bidding paths in tests where permitted.
- **SC-004**: Post-migration DB invariant: no user row has legacy `administrator` / `accountant` role values.

## Assumptions

- Better Auth / session payloads expose `role` and `staff_role` to the web app for nav and guards.
- One-shot SQL migration is applied before relying on the new invariant in production.
