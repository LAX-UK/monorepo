# V1 Invitation Flow

## Objective

Allow administrators to invite both staff and clients with explicit role assignment at onboarding.

## Supported Invite Targets

- administrator
- accountant
- client

## Flow

1. Administrator opens invitation workflow.
2. Administrator enters invitee details and selects target role.
3. System generates and sends invitation token/link.
4. Invitee signs up using invitation link.
5. Account is created with assigned role.
6. Post-signup permissions reflect assigned role policy.

## Rules

- Only administrators can create invitations.
- Invitation must include role intent and expiry.
- Role assignment on acceptance must match invitation payload.
- Audit log should capture inviter, invitee, target role, and acceptance status.

## Failure Cases

- Expired invitation token.
- Reused invitation token.
- Invalid role in invitation payload.
- Account already exists with conflicting onboarding flow.
