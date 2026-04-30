# Invitation Contract (Draft)

## Create Invitation

- **Actor**: administrator
- **Input**:
  - invitee email
  - target role (`administrator` | `accountant` | `client`)
  - optional metadata (name/team note)
- **Output**:
  - invitation id
  - status
  - expiry

## Accept Invitation

- **Actor**: unauthenticated invitee (signup flow)
- **Input**:
  - invitation token
  - signup credentials/profile
- **Output**:
  - created account id
  - assigned role
  - invitation accepted timestamp

## Error Cases

- invalid token
- expired token
- already-used token
- forbidden inviter role
- unsupported target role
