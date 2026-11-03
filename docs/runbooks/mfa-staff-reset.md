# Resetting two-step verification (support)

Use when someone has lost both their authenticator app and their backup codes and cannot sign in. Support does this in Bid admin with **Reset two-step verification**. There is no separate script or direct call to make.

## Who can do it

- A staff member with the `support.respond` or `platform.admin.full` capability.
- Resetting a **staff** account needs the Administrator staff role. A support agent cannot weaken an administrator's sign-in. Anyone else can be reset by any permitted agent.
- The action asks for a recent sign-in. If yours is older than the step-up window you are sent through a fresh sign-in and then return to the same screen.

## Before you reset

Check who is asking, out of band, under the internal identity-proof policy, and keep the support ticket id. The reset removes the only protection that was stopping someone else from using the account.

## Reset

1. In Bid admin find the person under **Clients** (a customer) or **Staff** (a team member), in the list or on their record.
2. Open the actions menu and choose **Reset two-step verification**. It is disabled, with the reason shown, when two-step verification is not turned on for that person.
3. Enter the reason (10 to 500 characters; include the ticket id) and confirm.

## What happens

1. The request is `POST /admin/users/{userId}/two-factor/reset` on the API, which checks the capability, the staff-target rule and the step-up.
2. The reason and your user id are written to the audit log as `auth.two_factor_reset_by_staff` **before** Identity is asked to act, so there is never a reset without an audit entry.
3. Identity (`resetTwoFactor`, reached through the internal `POST /identity/subjects/{subjectId}/two-factor/reset`) removes the person's authenticator enrolment and backup codes and turns two-step verification off, in one transaction.
4. In the same transaction all of their sessions are deleted and a `user.session_revoked` event is published. Identity then signs them out of every relying party (Bid, Shop, lax.art, LAX Account).
5. After the reset has committed, the person gets an email from LAX Account saying support reset their two-step verification. A failed email never undoes the reset.

If Identity is unreachable the screen shows "The sign-in service could not reset it. Try again." The audit entry from step 2 already exists, so a retry produces a second entry; note both in the ticket.

## After the reset

The person signs in with their usual method. If a staff or organisation policy requires two-step verification for them, they are sent to set it up at that sign-in unless they use Google or Apple. Otherwise it stays off until they turn it on again in LAX Account security.

## Audit

The entry is stored as `auth.two_factor_reset_by_staff` with the target user, your user id and the reason. Cross-reference the ticket id from the reason.
