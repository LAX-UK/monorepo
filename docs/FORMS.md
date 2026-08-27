# Forms: RHF + Zod + SOLID (web)

This app standardizes on **react-hook-form**, **zod** (schemas from `@auction/validators` and thin UI-layer schemas in `apps/web/src/lib/forms/schemas/`), and **server actions** that return `ActionResult` for field-level errors.

## Layers

1. **Validators** — `packages/validators` is the source of truth for API-shaped payloads.
2. **UI schemas** — optional `.extend()` / `.transform()` in `apps/web/src/lib/forms/schemas/*` for UI-only fields (e.g. `confirmPassword`, `termsAccepted`).
3. **Server actions** — `"use server"`; parse with zod; call **write services** from `getWriteContainer()`; return `ActionResult` (see `apps/web/src/lib/forms/form-result.ts`).
4. **Services** — `apps/web/src/lib/services/impl/*` use `IAuthedApiClient` (cookie-authenticated JSON to the Hono API). Composed in `getWriteContainer()` (`apps/web/src/lib/data/write-container.server.ts`).

## `ActionResult`

```ts
import type { ActionResult } from "@/lib/forms/form-result";

// ok: { ok: true, data? }
// err: { ok: false, error: string, fieldErrors?, status? }
```

Map Zod issues with `zodErrorToFieldErrors` so RHF can `setError` per field.

## Client hook

- **`useActionForm`** — `apps/web/src/lib/forms/use-action-form.ts` (generic RHF + server `ActionResult` + toasts).
- **Feature controllers** — e.g. `useCreateSubmissionController`, `useProfileNameController` (RHF + `action` + `router`).

## New form checklist

- [ ] Schema in `@auction/validators` (or a UI schema that `.transform()`s to it).
- [ ] Server action: `parse → getWriteContainer().* → revalidatePath → return actionSuccess` (no raw `fetch` in the action).
- [ ] Client: RHF + `zodResolver` + `@auction/ui` `Form`/`FormField` primitives.
- [ ] For redirects after success, prefer `router.push` + `actionSuccess` data, or return `{ redirectTo }` from the action and navigate on the client.

## Testing

- Mock `IAuthedApiClient` to unit-test service classes without HTTP.
- `apps/web/src/lib/services/impl/*.test.ts` (see vitest) — optional but recommended for new services.

## Progressive migration

- URL-only filters (portfolio/bids) use `urlTitleSearchSchema` + RHF; no server action.
- Large admin `datetime-local` + many fields pages may still use `form action` + `createLotSchema` in the action; converting those to RHF is the same pattern as `BiddingPreferencesForm` / submission flows, with more fields.

## UI primitives and allowed shortcuts

- **GET / server-only forms** (e.g. admin user directory search, marketing `/search`): native `<form method="get">` is fine. Use **`@auction/ui/components/input`** for visible fields so styling matches the design system; **hidden** `<input type="hidden" />` for preserving query params is acceptable.
- **Native `<select>` for SSR-only forms** — `apps/web/src/components/ui/select-field.tsx` (`SelectField`) is the documented wrapper for simple server-rendered selects (labels + tokens). Prefer it over ad-hoc `<select className="…">` in new code.
- **Command palette / combobox** — `apps/web/src/components/layout/command-palette.tsx` uses a single search field with ARIA listbox semantics. It uses the shared **`Input`** primitive for consistent focus rings and borders; it is not a full RHF form.
- **Resend / revoke invitation** — small POST forms with hidden `invitationId` + `Button type="submit"` remain native `form action` + server actions (no client state).

## Buyer auction interests

- **Onboarding completion** — `PUT /users/me/category-interests` via `completeBuyerInterests` server action; atomically saves selections and marks the one-time onboarding prompt complete.
- **Settings edits** — `/dashboard/settings/interests` uses `saveAuctionInterestPreferences` and `PUT /users/me/category-interests/preferences`; updates selections without changing onboarding completion.
- **UI** — native form + hidden checkbox inputs (`BuyerInterestsForm`, `AuctionInterestsSettingsForm`); no `complete=true` flag on a shared endpoint.

## Bid eligibility actions

- Lot bid blockers reuse `SendVerificationEmailButton` and the existing
  `sendVerificationEmailForReturnPath` service. Pass the lot path as `next` so the
  verification callback returns to the attempted bid.
- `BidGate` owns pre-submit eligibility presentation across manual, auto-bid,
  sticky-mobile, and video-compact surfaces. API error mapping remains the
  stale-session fallback and must prefer structured error codes.
- Strict eligibility applies to the acting user for both personal and
  organisation bidding. Organisation KYB, membership, sale registration, and
  buyer-agent authorisation remain separate form/gates and are not replaced by
  Stripe Connect payout onboarding.
