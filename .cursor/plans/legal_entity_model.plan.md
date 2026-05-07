# Legal Entity Model — Implementation Plan

This plan file documents the architectural decisions and phased implementation of the legal entity model — the structural change that separates "who logs in" (User) from "the legal seller/buyer" (Legal Entity) from "who made the work" (Artist), with symmetric buyer/seller scoping, Stripe Identity for human KYC, Stripe Connect Express for organisation KYB, and a first-class artist registry.

The file is organised in three layers:

- **§1 — Open questions (answered).** Fourteen questions (Q0–Q13) that scoped the work, with the locked answers.
- **§2 — Architectural decisions (DSE1–DSE36).** Numbered decisions in seven groups (data model, migration, Stripe, admin dashboard, artist registry, cross-cutting, follow-on DSE31–DSE36).
- **§3 — Phasing (SE-P0 through SE-P21).** PR-sized implementation phases with sequencing constraints. **All phases SE-P0 through SE-P17 are complete** (on disk, uncommitted); **SE-P19** is the completeness backfill phase; **SE-P20** is Round 2 security hardening (complete); **SE-P21** is Round 3 launch production correctness (complete). Deferred work and follow-ups are consolidated at the end of §3.

Phases reference DSE numbers throughout. Decisions reference question numbers. Each layer is self-contained but cross-referenced — read top to bottom for a full picture, or jump to a phase and follow DSE references back into the architecture.

---

## §1 — Open questions (answered)

### Strategic decisions locked above all questions

Four meta-decisions affect every question below:

**A. Symmetric model.** Both buyer and seller of every transaction are legal entities. The central table is named `legal_entity` (renamed from earlier `selling_entity` to reflect symmetry). Anti-shilling, payouts, payments, and acting context all apply on both sides.

**B. Stripe Identity for human KYC, Stripe Connect Express for org KYB.** Single-vendor identity stack on top of Stripe Payments. Veriff is no longer in the plan; references in any prior planning artifact (`.cursor/plans/veriff_kyc_integration_*.plan.md`) are superseded and archived.

**C. Two-level taxonomy on legal_entity.** `kind` enum is `individual | organisation`. A separate `subkind` enum is context-dependent: for individuals → `artist | private_collector`; for organisations → `gallery | dealer | estate | company | charity | institution | lax_stock | other`. This taxonomy drives admin filtering, dashboard segmentation, document-collection rules, and Xero contact category — not just display labels.

**D. Artist as first-class catalogue concept.** The artist (also: maker, brand, marque) is separate from any user or legal_entity. Has its own registry, search-existing-or-create-pending workflow, deduplication review, and optional link to a user account. Not a side concern — has its own implementation phase.

---

### Q0 — Verification lifecycle states, transitions, per-state effects, per-kind differences

**States** (the values stored on `legal_entity.status`):

- `lead` — created, no docs uploaded, no review yet
- `docs_requested` — admin reviewed lead, sent doc-request email; entity is waiting on the user
- `docs_received` — user uploaded docs; pending admin re-review
- `under_review` — admin actively reviewing
- `connect_pending` — admin approved docs, Stripe Connect onboarding in progress
- `approved` — verified (admin AND Stripe Connect both green); can transact
- `restricted` — admin flagged concerns; can submit but new lots require admin co-sign
- `rejected` — verification failed; cannot transact
- `archived` — terminal state for rejected (after 90 days) or admin force-closed

**Transitions:**

| From | To | Trigger |
|---|---|---|
| lead | docs_requested | admin |
| docs_requested | docs_received | user uploads |
| docs_received | under_review | admin claims |
| under_review | connect_pending OR rejected | admin |
| connect_pending | approved | Stripe Connect webhook (charges_enabled && payouts_enabled) |
| approved | restricted OR rejected | admin |
| rejected | archived | automatic after 90 days, OR admin |
| any state | archived | admin force-close |

**Effects per state:**

| State | Submit lots? | Bid as entity? | Receive payouts? | Be acted-as? |
|---|---|---|---|---|
| lead | No | No | No | No |
| docs_requested | No | No | No | No (read-only context) |
| docs_received | No | No | No | No (read-only) |
| under_review | No | No | No | No (read-only) |
| connect_pending | No | No | No | Yes (limited UI) |
| approved | Yes | Yes | Yes | Yes |
| restricted | Yes (admin co-signs) | Yes | Yes | Yes |
| rejected | No | No | No | Hidden |
| archived | No | No | No | Hidden |

**Per-kind differences:**

- `kind='individual'` — auto-progresses `lead → connect_pending → approved` when: `user.email_verified=true AND user.kyc_status='approved' (Stripe Identity) AND Stripe Connect onboarding completes`. No admin doc review for individuals; their Stripe Identity verification is sufficient.
- `kind='organisation'` (regardless of subkind) — starts at `lead`, never auto-progresses, always requires admin doc review THEN Stripe Connect Express onboarding.
- **Special case: `kind='organisation', subkind='lax_stock'`** — skip Stripe Connect entirely (LAX-managed stock doesn't pay out to itself externally). Set state directly to `approved` on creation, with `is_lax_managed=true` flag. Reconciliation happens internally in Xero. Only platform admins can create lax_stock entities.

**Multi-entity per user with one suspended:** the dropdown surfaces it but disables it ("Restricted: contact support" tooltip). Don't hide — user needs to know it exists.

---

### Q1 — Roles matrix

Strictly **one role per (user, legal_entity) pair** (O(1) authorization checks). Eight roles:

| Role | edit profile | invite/remove members | submit | convert to lot | edit lot | approve payout | view financials | view buyer PII | request KYB upload | bid as entity | auto-CC entity emails |
|---|---|---|---|---|---|---|---|---|---|---|---|
| owner | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| admin | Y | Y (not owner) | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| consignor | N | N | Y | N | Y (own) | N | own only | N | N | N | own emails |
| finance | N | N | N | N | N | Y | Y | Y (limited) | N | Y | financial only |
| buyer_agent | N | N | N | N | N | N | N | N | N | Y | bid notifications |
| viewer | N | N | N | N | N | N | summary only | N | N | N | N |
| specialist | N | N | Y | Y | Y | N | N | N | Y | N | Y |
| staff | N | N | Y | N | Y (limited) | N | N | N | N | N | N |

**`buyer_agent` exists** because the symmetric model means corporate buyers need a role that bids on behalf of the entity without seller-side capabilities.

**`owner` distinct from `admin`:** owner cannot be removed by other admins (only by other owners or platform admin). `is_primary_admin` boolean is separate — exactly one per entity, must have role in {owner, admin}; this is the "Authorised Representative" from the original client spec.

**`specialist`** is a platform-staff seat that lives on the *client's* entity (LAX specialist can be added to gallery's entity to ghost-edit submissions during VIP onboarding). Opt-in by gallery; LAX cannot self-add.

---

### Q2 — Acting context: storage, propagation, validation, audit

**Storage.** Cookie `acting_legal_entity_id` scoped to `.lax.bid` (matches existing `CLIENT_WORKSPACE_COOKIE` pattern).

**Propagation.** Web client sends `X-Legal-Entity-Id: <uuid>` header on every API request that's entity-scoped.

**Validation.** Server middleware at `apps/api/src/middleware/require-legal-entity-context.ts` reads the header and looks up `legal_entity_member WHERE user_id = $userId AND legal_entity_id = $headerId AND removed_at IS NULL`. Returns 403 `legal_entity_membership_invalid` if no row. Sets `c.set('actingLegalEntityId', id)` and `c.set('actingMemberRole', role)`.

**Audit.** Every domain event row includes `acting_legal_entity_id` (nullable, separate from `actor_user_id`) so audit reconstruction can show "this action was taken by user X acting as entity Y."

**Same entity across tabs** (cookie-scoped) — documented as a v1 constraint. Per-tab acting context deferred to v2.

**First-switch tooltip (M2):** first time a user with >1 legal_entity opens the switcher, show one-time tooltip "This applies across all your tabs. Switch back here when you're done." Tracked via `user.has_seen_acting_context_tooltip` boolean.

**UI:** top-of-page `<ActingAsBanner/>` shows current context for users with multiple entities. Hidden when user has only their individual entity (the common case for individual sellers).

---

### Q3 — Buyer-side scope: SYMMETRIC

Both sides of every transaction reference `legal_entity`. Renamed from `selling_entity` to reflect this.

**References that move from `user_id` to `legal_entity_id`:**

- `lot.seller_legal_entity_id` (was `seller_id`)
- `bid.buyer_legal_entity_id` (new) AND `bid.placed_by_user_id` (preserved for audit — answers "who placed this bid (human)" AND "on whose behalf (legal entity of record)")
- `payment.buyer_legal_entity_id` (was `user_id`)
- `payment.seller_legal_entity_id` (new — symmetric mapping)
- `payout.legal_entity_id` (new table; entity being paid)
- `item_submission.legal_entity_id` (which entity is consigning)
- `artist_profile.owner_legal_entity_id` (was `owner_user_id`; see Q6)

**Acting context applies to both sides.** Most users (individuals only) only ever act as themselves — for them, no UI change.

**Invoice addressing for corporate buyers:** when `payment.buyer_legal_entity_id` references an organisation, bill-to renders `legal_entity.legal_name` + `legal_entity_address (registered_office or billing)` + `vat_number` line. When individual, falls back to `user.name` + `user_address (default)`. See DSE32.

---

### Q4 — Anti-shilling rule

**Strict, with the symmetric extension.** No member of the seller's legal_entity may bid on its lots, regardless of which entity they're acting as:

```sql
canBid(buyerEntity, lot) =
  NOT EXISTS (
    SELECT 1
    FROM legal_entity_member m_buyer
    JOIN legal_entity_member m_seller
      ON m_buyer.user_id = m_seller.user_id
    WHERE m_buyer.legal_entity_id = $buyerEntityId
      AND m_seller.legal_entity_id = $lot.seller_legal_entity_id
      AND m_buyer.removed_at IS NULL
      AND m_seller.removed_at IS NULL
    LIMIT 1
  )
```

Closes both:
- "Director of Acme bids personally on Acme's lot" (member of seller bidding directly)
- "Acme's gallery buys from Acme's estate when both share members" (cross-entity shared-member shilling)

Platform `administrator` users keep their dev/test bypass (mirrors `requireBuyerRoleUnlessAdministrator` pattern).

**Proxy bidding interaction (DSE36 → SE-P13):** anti-shilling check runs at proxy creation time AND at each automated bid the proxy generates. Currently only the auto-bid check is implemented; creation-time check + `bid.proxy_cancelled` emission ship in SE-P13.

---

### Q5 — Payouts scope

**In scope for v1: payout method + payout table + Stripe Connect Express + adjustment lines.**

**New tables:**

- `legal_entity_payout_method` — per-entity payout config. For Stripe Connect, mostly metadata since Stripe holds the bank account.
- `payout` — one row per settlement run per entity.
- `payout_line` — line items per payout, joining to `payment` rows OR standalone for adjustments.

**Frequency.** Default weekly, Mondays 09:00 UTC. Per-entity custom schedule deferred to v2.

**Eligibility.** Settlement worker processes legal_entities with `status IN ('approved','restricted')` AND `is_lax_managed = false` AND `stripe_connect_payouts_enabled = true`.

**Currencies.** GBP only for v1. The `currency` column exists for forward-compat (per Q13) with `CHECK (currency = 'GBP')` for now.

**Adjustments (DSE-X locked).** `payout_line.kind` enum: `sale | refund | chargeback | platform_credit | adjustment`. Adjustment lines require `created_by_user_id` (admin) and `note` (free-text reason). Adjustment-kind lines emit `payout.adjustment_added` domain event. CHECK constraints enforce: adjustment requires created_by + note; non-adjustment requires payment_id.

**Reversals.** When `transfer.failed` or `transfer.reversed` webhook arrives, payout flips to `failed` or `reversed`. Refunds-after-paid go in next settlement as negative-amount `kind='refund'` line.

**Reporting (DSE33 → SE-P15).** Per-payout downloadable PDF statement at `/dashboard/legal-entities/{id}/payouts/{payoutId}/statement.pdf`. Cached in Spaces under `payout-statements/{legal_entity_id}/{payout_id}.pdf` for 7 years (UK accounting retention). Out of scope for v1: aggregate reports across multiple payouts, CSV export, scheduled emails.

**LAX Stock special case.** `subkind='lax_stock'` entities skip settlement entirely — funds stay in the platform's own Stripe balance. Xero treats LAX-Stock sales as direct revenue.

---

### Q6 — Artist ownership: registry, merges, ownerLegalEntityId, consignment

**Migrate `artist_profile.owner_user_id` → `artist_profile.owner_legal_entity_id`.** Symmetry with the rest of the model. Backfill: every existing `owner_user_id` becomes the user's auto-created individual legal_entity's id.

**Artist registry properties:**

- An artist record exists independently of any legal_entity. Banksy exists once; many entities can sell Banksy works.
- Artist records have `kind`: `artist | maker | brand | marque` (same table represents Banksy, Rolex, Hermès, Ferrari). Lot pages render the appropriate label.
- Artist records have `status`: `pending | approved | rejected | merged_into`. New records default to `pending` to prevent duplicate creation.
- Artist records have `merged_into_artist_id` (nullable) — when admin discovers a duplicate, they merge by setting this pointer; lots automatically resolve to canonical record.
- An artist may optionally link to a `legal_entity` (the artist's own self-managed entity) via `owner_legal_entity_id`. Most artists won't have this — they're catalogue records, not platform users.

**Auto-creation rule (DSE-Y locked).** `artist_profile` is NOT auto-created when a `legal_entity` with `subkind='artist'` is created. Created on-demand when:
- Admin/specialist creates a lot referencing this person as artist (search-or-create-pending UX), OR
- Artist self-claims their page from `/dashboard/seller/artist`

Avoids polluting the registry with empty placeholder rows.

**Artist creation workflow at lot creation:**

1. Admin/specialist starts creating a lot
2. In the Artist field, searches existing registry (3-pass: exact → alias → fuzzy via `pg_trgm`)
3. If match exists with `status='approved'`: select, done
4. If match exists with `status='pending'`: select, lot is also marked `lot.artist_review_required=true` until artist approved
5. If no match: open inline "Create artist" form (name, kind, optional bio). New artist saves with `status='pending'`. Lot uses it; lot is gated on artist approval

**Admin artist review queue at `/admin/artists/review`:** approve, reject, or merge into existing.

**Merge UX:** select canonical artist, click "Merge into" — single transaction migrates all lot references AND aliases to canonical record, archives source as `status='merged_into'`. Old code holding duplicate UUID still resolves correctly via `resolveArtist(id)` helper that follows the chain.

**`lot.artist_id`:** new column referencing `artist_profile`. Replaces the previous JSON-based `marketing_details.sellerArtistId` / `.artistNote` keys. Three-pass backfill (DSE-Z) handles migration.

**Consignment chains explicitly OUT OF SCOPE for v1.** The system models one `seller_legal_entity_id` per lot. Multi-party splits ("estate consigns to gallery; proceeds 70/30") aren't represented; galleries handle the split off-platform via internal accounting. v2 may add `lot.consignor_legal_entity_id` (nullable) and `consignment_split` table — current model is forward-compatible.

---

### Q7 — User-scoped tables: what stays, what moves

| Table | Stays user-scoped? | Notes |
|---|---|---|
| user_address | Yes | Personal billing/shipping. Add separate `legal_entity_address` for registered office, collection, returns. |
| notification_preference | Yes (per-user) | Each member tunes own inbox. Entity events route to: `lot.sold` → roles {owner, admin, consignor, finance}. `payout.processed` → {owner, admin, finance}. `member.invited` → {owner, admin}. `bid.outbid` (entity acting as buyer) → {owner, admin, finance, buyer_agent}. |
| watchlist | Yes | Personal interest. |
| artist_watchlist | Yes | Personal. |
| bidding_preferences | Yes | Personal. |
| notification.read_at | Yes | Per-user inbox. |

---

### Q8 — Migration & backfill strategy

**Eager backfill.** Every existing user gets an individual legal_entity at migration time, regardless of whether they've ever sold. Negligible cost (one row per user); simpler downstream because every code path can assume `legalEntityId` is non-null after migration.

**Existing in-flight submissions/lots:** backfill `legal_entity_id` from `seller_id` in same migration.

**Drop window:** keep both columns for one full release after dual-write switch; drop in follow-up migration. Three-migration shape:

- `0027_legal_entity_foundation` — add tables + nullable FKs + backfill
- `0028_legal_entity_dual_write` — flip writes, both columns valid
- `0029_drop_legacy_seller_id` — drop legacy columns (separate release)

**Tested rollback companions per migration (DSE-V).** Each forward migration ships with a hand-written reverse counterpart, tested in CI. `0028_rollback.sql` MUST backfill new-column writes back to old columns for any rows written between deploy and rollback — without this, rollback silently loses writes.

**Dual-write contained to repo layer (DSE8).** The repository layer is the only code that writes both columns. Service code passes a single `legalEntityId` parameter; the repo writes both columns during the dual-write window. Contains blast radius to four files.

---

### Q9 — KYC vs entity verification: layered model

**Stripe Identity for human KYC. Stripe Connect Express for org KYB. Veriff is no longer in the plan.**

**Layer 1: Human identity (Stripe Identity).** Every user verifies once when crossing a threshold:
- First bid placed
- First lot listed
- First time being added as beneficial owner of an org entity

`user.kyc_status` enum: `unverified | pending | approved | rejected`. Once approved, persists indefinitely.

**Layer 2: Individual entity verification (automatic).** `kind='individual'` legal_entities auto-progress to `approved` when:
- `user.email_verified = true`
- `user.kyc_status = 'approved'`
- Stripe Connect onboarding completes

**Layer 3: Organisation entity verification (admin docs + Stripe Connect KYB).** `kind='organisation'`:
1. Document upload (Companies House extract for UK, equivalent for non-UK, VAT cert if applicable, beneficial-owner info, sample provenance docs)
2. Admin commercial review (your team reads docs, judges legitimacy)
3. Stripe Connect Express onboarding (Stripe handles AML/regulatory KYB)
4. Approved when admin AND Stripe Connect both verified
5. Beneficial owners must each be Stripe-Identity-verified users

**Why this split:** Stripe Connect handles regulatory KYB (AML watchlists, company validation) — don't duplicate. Admin review is for commercial judgement. Stripe Identity handles humans, reusable across entities they're members of.

**Cross-entity reuse:** a user who's verified once is verified for ALL entities they're a member of. Never asked to re-verify per entity.

**Bidding-side gate:** when bidding as an organisation entity, entity must be `approved`. When bidding as own individual entity, requires `user.kyc_status='approved'`.

**Listing-side gate:** cannot publish lots unless acting legal_entity is `approved` or `restricted` (with admin co-sign).

---

### Q10 — API authorization mechanism

**Header `X-Legal-Entity-Id` set by web client from cookie. Server middleware validates membership.**

New `requireLegalEntityMember(roleSet)` middleware parallels `require-buyer-role.ts`. Reads header, validates user is an active member of that legal entity with a role in the required set, attaches `ctx.actingLegalEntityId` and `ctx.actingMemberRole` to the Hono context.

**Admin override:** platform `administrator` users can act-as any entity for support via runtime auto-membership (not stored in DB). When `requireLegalEntityMember` checks, if `user.role='administrator'`, check passes without DB lookup.

**Admin impersonation safety (DSE34 → SE-P16):** when admin acts-as an entity they're NOT a member of, treat as impersonation: 4-hour cookie timeout, mandatory red banner, automatic notification email to entity owners/admins, separate event types `admin.impersonation_started` and `admin.impersonation_ended`.

**Routes:**
- `GET /legal-entities/:id` — open for entity profile pages (resource-style URI)
- Mutations stay namespaced under `/dashboard/...` for existing convention

---

### Q11 — Domain events: payload shape and versioning

**Add `acting_legal_entity_id text` (nullable) to `domain_events`.** Free at insert time, irreplaceable later.

**Bump schema_version on existing event types.** Existing types (`lot.created`, `submission.submitted`, `payment.captured`, `bid.placed`, etc.) get bumped to `schema_version=2` with `legalEntityId` and `actingLegalEntityId` in payloads. Existing consumers handle both v1 and v2 via projector code paths. **No retroactive backfill of payloads** — historical events keep v1 shape.

**New event types ship at schema_version=1:**

- `legal_entity.created`
- `legal_entity.docs_requested` (SE-P17 admin: lead → docs_requested)
- `legal_entity.review_started` (SE-P17 admin: docs_received → under_review; past-tense naming aligned with `artist.reviewed` / `docs_requested`)
- `legal_entity.approved` (SE-P17 admin: under_review → connect_pending)
- `legal_entity.restricted` (SE-P17 admin: approved → restricted)
- `legal_entity.rejected` (SE-P17 admin: → rejected, requires reason)
- `legal_entity.archived` (SE-P17 admin: → archived, requires reason)
- `legal_entity.docs_received`
- `legal_entity.connect_initiated`
- `legal_entity.member_invited`
- `legal_entity.member_accepted`
- `legal_entity.member_removed`
- `legal_entity.member_role_changed`
- `payout.scheduled`
- `payout.processed`
- `payout.failed`
- `payout.reversed`
- `payout.adjustment_added` (DSE-X)
- `artist.created`
- `artist.approved`
- `artist.rejected`
- `artist.merged`
- `admin.impersonation_started` (DSE34 → SE-P16)
- `admin.impersonation_ended` (DSE34 → SE-P16)
- `bid.proxy_cancelled` (DSE36 → SE-P13)

**Shipped payout event naming (variance vs this wish-list).** Production code emits lifecycle-specific payout types such as `payout.settlement_created`, `payout.transfer_initiated`, `payout.transfer_failed`, `payout.transfer_reversed`, `payout.reversed`, `payout.paid`, etc. These **replace** the older generic bullets (`payout.scheduled`, `payout.processed`) for Stripe-backed flows — **do not rename** event strings without migrating projectors, finance dashboards, and Xero hooks.

**PII policy (DSE31 → SE-P15).** Payloads minimize PII by default — references only (`userId`, `legalEntityId`, `paymentId`). Consumers join to resolve PII at projection time. Exceptions where PII is included directly:
- `legal_entity.member_invited` — invitee email (consumer is email worker; alternative requires last-mile join)
- `payment.captured` — buyer's display name and email (Xero invoice records are point-in-time)
- `kyc.verified` — verified name and DOB (kyc_verification table is only persistence)

For every other event type: payload contains references only.

**Send-time recipient resolution (M1).** For email notifications driven by domain events, recipient resolution happens at send-time in the worker, not at enqueue time. Members added between event emission and email send still receive the notification.

---

### Q12 — user.role vs legal_entity_member.role interaction

**Confirmed orthogonal:**

- `user.role` stays platform-level (`client | accountant | administrator`). Never affected by entity membership.
- `legal_entity_member.role` is entity-scoped. Never affects platform admin pages.
- A `finance` member of Acme Gallery has no platform capability — they just gain access to Acme's payout pages because the service layer scopes payout reads by entity membership.

**Platform `administrator` can act-as any entity** for support purposes via runtime auto-membership (not stored in DB). Audit log records both `actor_user_id` (the admin) and `acting_legal_entity_id` (the entity).

**Capability set (DSE17 implemented + DSE35 → SE-P13):**

Implemented today: `platform.admin.full`, `finance.read`, `finance.write`, `user.invite`, `auction.manage`, `bid.place`, `client.submit`.

Scheduled in SE-P13 (DSE35): broader set including `legal_entity.read | write | approve | archive`, `artist.read | review | merge`, `payout.read | process | reverse`, `audit.read_pii`.

---

### Q13 — Out-of-scope items

| Item | In/Out for v1 |
|---|---|
| Cross-entity transfers (lot moves between entities) | OUT |
| Renaming/merging legal entities | OUT (admin DB-level if needed) |
| Multi-currency per entity | OUT (GBP only) |
| Per-entity tax/VAT settings (`vat_number`, `margin_scheme_eligible`) | IN |
| Per-entity buyer-premium override | OUT (sale.buyerPremiumRate stays) |
| Public entity profile pages | OUT |
| Soft-delete / closure flow | IN (covered by `archived` state) |
| Per-entity Stripe platform fee override (`platform_fee_bps`) | IN |
| Cross-currency payouts | OUT |
| Multi-seller split payments | OUT |
| Refunds touching payout reconciliation | IN (negative entry in next payout) |
| LAX Stock subkind | IN (first-class subkind, special-case payout) |
| Artist registry with pending/approved/merged | IN |
| Maker/Brand/Marque labelling on artist | IN (artist `kind` enum drives display) |
| Artist user_account link | OUT (artists are catalogue records by default) |
| Consignment chains | OUT |
| Aggregate payout reports / CSV export / scheduled emails | OUT |
| Proxy bidding | IN (existing in codebase) |
| Anti-shilling check at proxy creation (DSE36) | SE-P13 ✅ |
| Admin impersonation 4hr timeout / banner / events (DSE34) | SE-P16 (planned) |
| Invoice addressing service for corp buyers (DSE32) | SE-P14 ✅ |
| Payout statement PDF generation (DSE33) | SE-P15 (planned) |
| Capability expansion (DSE35) | SE-P13 ✅ |
| Domain event PII policy formalisation (DSE31) | SE-P15 (planned) |
| Xero entity-level Contact + Bill projection | SE-P14a ✅ (core) |
| Admin legal entity lifecycle HTTP (DSE17 routes) | SE-P17 (queued after SE-P16) |

---

## §2 — Architectural decisions (DSE1–DSE36)

Decisions are numbered DSE1–DSE36 and grouped into seven clusters. Phases in §3 cite these decisions ("SE-P0 implements DSE1, DSE2, DSE3...") so the architectural reasoning behind each phase is recoverable from this section.

### Group A — Data model: new tables (DSE1–DSE5)

#### DSE1 — `legal_entity` table

New file `packages/db/src/schema/legal-entities.ts`.

**Columns:**

- `id uuid PK default gen_random_uuid()`
- **Identity:** `display_name text NOT NULL`, `legal_name text` (nullable; org form vs trade name), `slug text` (nullable; reserved for future public profiles)
- **Taxonomy:** `kind legal_entity_kind NOT NULL` (enum `individual | organisation`), `subkind legal_entity_subkind NOT NULL` (enum `artist | private_collector | gallery | dealer | estate | company | charity | institution | lax_stock | other`)
- **Audit:** `created_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT`
- **Status:** `status legal_entity_status NOT NULL DEFAULT 'lead'` (enum per Q0 lifecycle), `status_changed_at timestamptz`, `status_changed_by_user_id text REFERENCES "user"(id)` (nullable; null when system-driven)
- **Stripe Connect:** `stripe_connect_account_id text UNIQUE` (nullable until onboarding starts), `stripe_connect_charges_enabled boolean DEFAULT false`, `stripe_connect_payouts_enabled boolean DEFAULT false`, `stripe_connect_requirements_currently_due jsonb DEFAULT '[]'::jsonb`
- **Xero:** `xero_contact_id text` (nullable; one Contact per legal_entity; **SE-P14a** automates find/create + persistence and sync on address/VAT changes — see §3)
- **Tax:** `vat_number text`, `margin_scheme_eligible boolean DEFAULT false`
- **Platform:** `is_lax_managed boolean DEFAULT false` (true only when `subkind='lax_stock'`), `platform_fee_bps integer` (nullable; null = use platform default)
- **Timestamps:** `created_at timestamptz DEFAULT now() NOT NULL`, `updated_at timestamptz DEFAULT now() NOT NULL`

**Indexes:**
- `(status)` — admin filter
- `(kind, subkind)` — admin filter, taxonomy reports
- `(created_by_user_id)`
- `(stripe_connect_account_id)` — webhook lookup
- `(is_lax_managed) WHERE is_lax_managed` — partial; tiny index for LAX stock filter
- Unique `(slug) WHERE slug IS NOT NULL`

**Constraints:**
- `CHECK ((kind = 'individual' AND subkind IN ('artist','private_collector')) OR (kind = 'organisation' AND subkind IN ('gallery','dealer','estate','company','charity','institution','lax_stock','other')))` — kind/subkind coherence at DB level (defense in depth)
- `CHECK (NOT is_lax_managed OR subkind = 'lax_stock')` — is_lax_managed gate

#### DSE2 — `legal_entity_member` table

New file `packages/db/src/schema/legal-entity-members.ts`.

**Columns:**
- `id uuid PK default gen_random_uuid()`
- `legal_entity_id uuid NOT NULL REFERENCES legal_entity(id) ON DELETE CASCADE`
- `user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`
- `role legal_entity_member_role NOT NULL` — enum `owner | admin | consignor | finance | buyer_agent | viewer | specialist | staff`
- `is_primary_admin boolean NOT NULL DEFAULT false`
- `invited_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL`, `invited_at timestamptz`, `accepted_at timestamptz`
- `removed_at timestamptz` — soft-delete (rows stay for audit)
- `created_at timestamptz DEFAULT now() NOT NULL`

**Indexes:**
- Unique `(legal_entity_id, user_id) WHERE removed_at IS NULL` — at most one active membership per pair
- Partial unique `(legal_entity_id) WHERE is_primary_admin = true AND removed_at IS NULL` — exactly one primary admin per entity
- `(user_id) WHERE removed_at IS NULL` — drives "list entities I'm a member of"
- `(legal_entity_id, role) WHERE removed_at IS NULL` — drives notification routing (DSE28)

**Constraint:**
- `CHECK (NOT is_primary_admin OR role IN ('owner', 'admin'))` — primary admin must be owner or admin

#### DSE3 — `legal_entity_address` table

New file `packages/db/src/schema/legal-entity-addresses.ts`. Sister to existing `user_address` per Q7.

**Columns:**
- `id uuid PK default gen_random_uuid()`
- `legal_entity_id uuid NOT NULL REFERENCES legal_entity(id) ON DELETE CASCADE`
- `address_type text NOT NULL` — values `registered_office | collection | returns | billing | both` (kept as text not enum so adding new types doesn't require DB migration; matches `user_address.address_type` pattern)
- Same `line1, line2, city, state, postal_code, country` fields as `user_address`
- `is_default boolean NOT NULL DEFAULT false`
- `created_at timestamptz DEFAULT now() NOT NULL`

**Index:** `(legal_entity_id, address_type)` — drives "give me the registered office for this entity"

#### DSE4 — `legal_entity_document` table

New file `packages/db/src/schema/legal-entity-documents.ts`. Wraps `upload_object` with KYB review state.

**Columns:**
- `id uuid PK default gen_random_uuid()`
- `legal_entity_id uuid NOT NULL REFERENCES legal_entity(id) ON DELETE CASCADE`
- `upload_object_id uuid NOT NULL REFERENCES upload_object(id) ON DELETE RESTRICT` — actual file in Spaces; this row is KYB wrapper
- `kind text NOT NULL` — values `companies_house_extract | vat_certificate | beneficial_owner_id | provenance_sample | bank_statement | other`
- `review_status text NOT NULL DEFAULT 'pending'` — values `pending | approved | rejected`
- `reviewed_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL`, `reviewed_at timestamptz`, `review_notes text`
- `uploaded_by_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT`, `uploaded_at timestamptz DEFAULT now() NOT NULL`

**Indexes:**
- `(legal_entity_id, review_status)` — drives per-entity document review surface
- `(review_status, uploaded_at) WHERE review_status = 'pending'` — partial; drives "documents awaiting review" widget

#### DSE5 — `legal_entity_payout_method`, `payout`, `payout_line` tables

New file `packages/db/src/schema/payouts.ts`.

**`legal_entity_payout_method`:**
- `id uuid PK`
- `legal_entity_id uuid NOT NULL REFERENCES legal_entity(id) ON DELETE CASCADE`
- `provider text NOT NULL DEFAULT 'stripe_connect'` — extension point for future providers
- `stripe_external_account_id text` — Stripe-side bank_account or card ID
- `is_default boolean NOT NULL DEFAULT false` — partial unique `(legal_entity_id) WHERE is_default = true AND status = 'active'`
- `status text NOT NULL DEFAULT 'active'` — values `active | retired`
- `created_at timestamptz DEFAULT now() NOT NULL`, `retired_at timestamptz`

**`payout`:**
- `id uuid PK`
- `legal_entity_id uuid NOT NULL REFERENCES legal_entity(id) ON DELETE RESTRICT` — payout history outlives entity archival
- `period_start timestamptz NOT NULL`, `period_end timestamptz NOT NULL`
- `gross_amount numeric(18,2) NOT NULL`, `platform_fee numeric(18,2) NOT NULL`, `stripe_fee numeric(18,2) NOT NULL`, `net_amount numeric(18,2) NOT NULL`
- `currency text NOT NULL DEFAULT 'GBP'` — `CHECK (currency = 'GBP')` for v1
- `status text NOT NULL DEFAULT 'scheduled'` — values `scheduled | in_transit | paid | failed | reversed`
- `stripe_transfer_id text UNIQUE` (nullable until worker calls transfers.create)
- `xero_bill_id text` (set by Xero projector)
- `failure_reason text`, `processed_at timestamptz`
- `created_at timestamptz DEFAULT now() NOT NULL`

**Indexes:**
- `(legal_entity_id, period_end DESC)` — entity payout history page
- `(status, period_end)` — admin payout queue
- `(stripe_transfer_id)` — webhook lookup

**Constraints:**
- `CHECK (period_end > period_start)`
- `CHECK (net_amount = gross_amount - platform_fee - stripe_fee)` — accounting integrity

**`payout_line`:**
- `id uuid PK`
- `payout_id uuid NOT NULL REFERENCES payout(id) ON DELETE CASCADE`
- `payment_id uuid REFERENCES payment(id) ON DELETE RESTRICT` — **nullable** so adjustment lines can exist without a payment reference
- `amount numeric(18,2) NOT NULL` — signed; refunds and chargebacks are negative
- `kind text NOT NULL` — values `sale | refund | chargeback | platform_credit | adjustment` (DSE-X)
- `created_by_user_id text REFERENCES "user"(id) ON DELETE RESTRICT` — required for `kind='adjustment'`, nullable otherwise
- `note text` — required for `kind='adjustment'`, nullable otherwise

**Constraints:**
- `CHECK (kind != 'adjustment' OR (created_by_user_id IS NOT NULL AND note IS NOT NULL))` — adjustment integrity
- `CHECK (kind = 'adjustment' OR payment_id IS NOT NULL)` — only adjustments may omit payment_id
- Unique `(payout_id, payment_id, kind) WHERE payment_id IS NOT NULL` — same payment can't be settled twice as same kind in same payout

---

### Group B — Migration & schema-evolution decisions (DSE6–DSE10)

#### DSE6 — Three-migration sequence

Online-safe per `docs/architecture/03-data-model.md`.

- **`0027_legal_entity_foundation.sql`** — create new enums, all new tables (DSE1–DSE5 + artist registry from DSE21–DSE22), add `legal_entity_id` columns as nullable FKs on `lot`, `item_submission`, `payment`, `bid`, `sale.created_by_legal_entity_id`, `artist_profile.owner_legal_entity_id`. Add `domain_events.acting_legal_entity_id`. Add `user.has_seen_acting_context_tooltip`. Add `user_invitation.target_legal_entity_id` and `target_legal_entity_member_role`. Run `CREATE EXTENSION IF NOT EXISTS pg_trgm`. Embed eager backfill SQL (DSE7) in same migration.

- **`0028_legal_entity_dual_write.sql`** — application code starts writing both `seller_id` and `legal_entity_id` columns. Mostly a code release; SQL is empty or just tightens grants. After this bakes in production, reads switch to `legal_entity_id`.

- **`0029_drop_legacy_seller_id.sql`** — drops `lot.seller_id`, `item_submission.seller_id`, `payment.seller_id`, `payment.buyer_id`, `artist_profile.owner_user_id`, plus JSON keys `marketing_details.sellerArtistId` / `marketing_details.artistNote`. Adds `NOT NULL` to all `legal_entity_id` columns. Ships at minimum one production release after `0028` stabilises.

**Tested rollback companions per migration (DSE-V).** Each forward migration ships with a hand-written reverse counterpart, tested in CI by apply → rollback → re-apply on same database:

- **`0027_rollback.sql`** — drops new tables (cascade), drops new columns, drops new enums, removes `pg_trgm` only if no other consumer.
- **`0028_rollback.sql`** — MUST backfill new-column writes back to old columns. Without this, rollback silently loses writes for rows written between deploy and rollback.
- **`0029_rollback.sql`** — recreates dropped legacy columns and JSON keys.

All three procedures documented in `docs/runbooks/legal-entity-migration-rollback.md`.

#### DSE7 — Eager backfill SQL

Embedded in `0027`. One-time SQL inside the migration's transaction:

- For every `user`: insert one `legal_entity` with `kind='individual'`, `subkind='private_collector'` (default), `status='approved'` (existing users have already been treated as approved), `created_by_user_id = user.id`, `display_name = COALESCE(user.name, user.email)`.
- For every newly inserted entity: insert `legal_entity_member` row with `role='owner'`, `is_primary_admin=true`, `accepted_at=now()`.
- Backfill `lot.seller_legal_entity_id`, `item_submission.legal_entity_id`, `payment.seller_legal_entity_id`, `payment.buyer_legal_entity_id`, `bid.buyer_legal_entity_id`, `sale.created_by_legal_entity_id`, `artist_profile.owner_legal_entity_id` from each row's existing user reference.

Estimate: O(N_users + N_lots + N_bids + N_payments). With current production sizes (low thousands), runs in seconds.

#### DSE8 — Dual-write window via repo adapter, not service code

The repository layer is the only code that writes both columns during the dual-write window. Service code passes a single `legalEntityId` parameter; the repo writes both `legal_entity_id` and the legacy `seller_id` (resolved via `SELECT created_by_user_id FROM legal_entity WHERE id = $legal_entity_id`).

Contains the dual-write blast radius to four files:
- `apps/api/src/repositories/drizzle-lot.repository.ts`
- `apps/api/src/repositories/drizzle-item-submission.repository.ts`
- `apps/api/src/repositories/drizzle-payment.repository.ts`
- `apps/api/src/repositories/drizzle-bid.repository.ts`

Service-layer code never sees the legacy columns. Dual-write logic removed in same release that ships `0029`.

#### DSE9 — `domain_events.schema_version` bump policy

Existing event types (`lot.created`, `submission.submitted`, `payment.captured`, `bid.placed`, etc.) bumped to `schema_version=2` with v2 payload adding `legalEntityId` and `actingLegalEntityId`.

Projectors handle both v1 and v2 via `if (event.schemaVersion === 1) {...} else if (event.schemaVersion === 2) {...}`. Old events in `domain_events` continue to work; new events ship the richer payload. **No retroactive backfill of payloads.**

New event types from Q11 ship at `schema_version=1` from day one with the full payload.

New column `domain_events.acting_legal_entity_id text` (nullable, not a FK — references can outlive the entity) added in `0027`. Indexed `(acting_legal_entity_id, occurred_at DESC)` for "show me everything done as Acme Gallery in the last 30 days".

#### DSE10 — Role grants for new tables

Update `packages/db/src/migrate-roles.ts`:

- `api_app` gets default `ALL PRIVILEGES` on every new table (catch-all branch — no code change needed).
- `worker_app` gets `SELECT` on `legal_entity`, `legal_entity_member`, `legal_entity_payout_method`, `kyc_verification` (settlement worker + Zoho projector need entity context). Add to `WORKER_READ_TABLES`.
- `worker_app` gets `SELECT, UPDATE` on `payout` and `payout_line`. Add to `WORKER_LOCK_READ_TABLES`.
- `worker_app` gets `ALL PRIVILEGES` on `webhook_event` already; no change for new Stripe webhook endpoints.
- `auth_app` unchanged — new tables are application-domain.

---

### Group C — Stripe integration decisions (DSE11–DSE15)

#### DSE11 — Stripe SDK package + env vars

Add `stripe` (official Node SDK) to `apps/api/package.json` and `apps/worker/package.json`. Single dependency covers Identity, Connect, and (eventually) Payments.

**Env vars** added to all three apps and `.env.example`:
- `STRIPE_SECRET_KEY` — server-side secret
- `STRIPE_PUBLISHABLE_KEY` — client-side; only this exposed via web env
- `STRIPE_WEBHOOK_SECRET_IDENTITY` — signing secret for Identity webhook
- `STRIPE_WEBHOOK_SECRET_CONNECT` — signing secret for Connect webhook
- `STRIPE_WEBHOOK_SECRET_PAYOUTS` — signing secret for Transfers/Payouts webhook
- `STRIPE_CONNECT_RETURN_URL` — e.g. `https://lax.bid/dashboard/legal-entities/{id}/connect/return`
- `STRIPE_CONNECT_REFRESH_URL` — e.g. `https://lax.bid/dashboard/legal-entities/{id}/connect/refresh`

**Cross-field validation:** if any one is set, all must be set (mirrors Xero pattern). When unset, KYC/Connect features are feature-flagged off.

New `apps/api/src/services/stripe/stripe-client.ts` wraps SDK with existing `Result<T, StripeError>` convention.

#### DSE12 — Stripe Identity threshold-trigger model

New schema file `packages/db/src/schema/kyc.ts`:

- Add to `user`: `kyc_status text NOT NULL DEFAULT 'unverified'` (values `unverified | pending | approved | rejected`), `kyc_verified_at timestamptz`, `date_of_birth date`
- New table `kyc_verification`:
  - `id uuid PK`
  - `user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`
  - `provider text NOT NULL DEFAULT 'stripe_identity'`
  - `stripe_verification_session_id text UNIQUE NOT NULL`
  - `status text NOT NULL` — values `created | requires_input | processing | verified | canceled`
  - **Verified fields** (extracted from Identity decision): `verified_first_name`, `verified_last_name`, `verified_date_of_birth date`, `verified_id_number_last4 text` (PII minimisation — only last 4), `verified_id_country text`, `verified_id_type text`, `verified_id_expiry date`
  - `decision_payload jsonb` — full webhook body, PII redacted
  - `created_at`, `decision_at timestamptz`

**Threshold triggers** (start an Identity session for `unverified` user):
- First bid placed (middleware on `POST /bids`)
- First lot listed (lot service before transitioning `draft → scheduled`)
- Added as beneficial owner of an organisation entity (member service)

**Session flow.** Server creates `VerificationSession` with `metadata={user_id}`, returns `client_secret`. Web embeds Stripe.js. Webhook delivers terminal verdict (`identity.verification_session.verified` or `requires_input`). Handler updates `kyc_verification`, flips `user.kyc_status`, overwrites `user.first_name / last_name / date_of_birth` with verified values.

**Cross-entity reuse.** Once `user.kyc_status='approved'`, every `kind='individual'` legal_entity owned by that user auto-progresses. A user verified once is verified for ALL entities they're a member of.

**SE-P18b — Legal entity status gating (state integrity).** Operational matrix for buyer vs seller paths when `legal_entity.status` is not the happy path:

| Path | `approved` | `restricted` | `rejected` / `archived` | Other non-terminal (e.g. `under_review`) |
|------|------------|----------------|-------------------------|--------------------------------------------|
| **Acting context** (`findActiveMembership` + cookie) | Allowed | Allowed | **Denied** (no active membership row surfaced) | Allowed while entity not terminal |
| **Place bid** (buyer entity = personal or org entity user bids with) | Allowed | Allowed | **403** `entity_not_authorised_to_bid` | **403** `entity_not_authorised_to_bid` |
| **Seller submission writes** (create/update/submit/withdraw) | Allowed | Allowed + emits `item_submission.restricted_entity_write` for admin audit | **403** | **403** |

Notes: `findActiveMembership` filters out `rejected` and `archived`, so middleware never attaches those entities. Bidding uses explicit `findById` gate on buyer entity. Submissions gate on seller `legalEntityId` for the submission.

#### DSE13 — Stripe Connect Express onboarding flow

**Trigger.** Admin transitions a `kind='organisation'` entity from `under_review → connect_pending`. For `kind='individual'`, automatic when `user.kyc_status` flips to `approved`.

**Sequence:**
1. Server creates Stripe `Account` via `accounts.create({type: 'express', country: 'GB', capabilities: {card_payments, transfers}, business_type, metadata: {legal_entity_id}})`. Persists `legal_entity.stripe_connect_account_id`.
2. Server creates `AccountLink` via `accountLinks.create({account, type: 'account_onboarding', return_url, refresh_url})`. Returns URL to web.
3. Web redirects user to Stripe's hosted onboarding pages.
4. User completes onboarding (KYB, beneficial owners, bank account).
5. Stripe sends `account.updated` webhook. Handler:
   - Persists `stripe_connect_charges_enabled`, `stripe_connect_payouts_enabled`, `stripe_connect_requirements_currently_due` on entity row.
   - When both `charges_enabled && payouts_enabled`, transitions entity from `connect_pending → approved` and emits `legal_entity.approved`.
   - When `requirements.currently_due` becomes non-empty after being empty, surfaces in admin "Stripe Connect issues" widget.

**LAX Stock special case.** `subkind='lax_stock'` skips DSE13 entirely. Created with `status='approved'`, `is_lax_managed=true`, no `stripe_connect_account_id`. Settlement worker excludes lax_stock entities. Only platform admins can create them (`is_lax_managed` flag in admin form).

#### DSE14 — Stripe webhook ingestion pattern

Three webhook endpoints in `apps/api/src/routes/webhooks/`:
- `POST /webhooks/stripe/identity` — secret `STRIPE_WEBHOOK_SECRET_IDENTITY`
- `POST /webhooks/stripe/connect` — secret `STRIPE_WEBHOOK_SECRET_CONNECT`
- `POST /webhooks/stripe/payouts` — secret `STRIPE_WEBHOOK_SECRET_PAYOUTS`

Three secrets so a leaked secret only compromises one event family.

**Handler pattern** (DSE-W):
- Read raw body via `c.req.text()` (signature verification needs raw bytes)
- Verify `Stripe-Signature` via `stripe.webhooks.constructEvent(rawBody, header, secret)`. Reject 401 on mismatch.
- **Replay-attack guard:** `constructEvent` enforces 5-minute timestamp tolerance by default. Do not raise. Reject 401 if `Stripe-Signature.t=` value older than 5 minutes.
- **Dedupe:** use existing unified `webhook_event` table per Q30 with `event_key = "stripe:" + event.id` (Stripe's authoritative id, NOT a hash). Forensic queries like `WHERE event_key = 'stripe:evt_1A...'` work directly against Stripe dashboard search.
- **Source classification:** `webhook_event.source` is `stripe.identity | stripe.connect | stripe.payments` per endpoint.
- **Forensic preservation:** write to `webhook_event` BEFORE dispatching to any service. Persist raw body (string), full headers including `Stripe-Signature` (jsonb), parsed event in `webhook_event.payload` (jsonb).
- Always respond 200 within 5s; on internal error log + persist + still 200.
- Skip rate-limit middleware (Stripe sends bursts from known IPs).

#### DSE15 — Payout settlement worker design

New worker job `apps/worker/src/jobs/settle-payouts.ts`. Cron-triggered (default weekly Mondays 09:00 UTC).

**Per legal_entity** with `status IN ('approved','restricted')` AND `is_lax_managed = false` AND `stripe_connect_payouts_enabled = true`:

1. Aggregate `payment` rows where `seller_legal_entity_id = entity.id` AND `status = 'captured'` AND not yet referenced by any `payout_line`.
2. Compute `gross = SUM(amount)`, `platform_fee = SUM(amount * COALESCE(legal_entity.platform_fee_bps, default_bps) / 10000)`, `stripe_fee` from Stripe estimate, `net = gross - platform_fee - stripe_fee`.
3. **Open transaction:**
   - Insert `payout` row with `status='scheduled'`
   - Insert one `payout_line` per contributing payment (`kind='sale'`)
   - Emit `payout.scheduled` domain event
   - Commit
4. **Outside transaction** (Stripe call must not hold DB lock): `stripe.transfers.create({destination: stripe_connect_account_id, amount, currency: 'gbp', metadata: {payout_id, legal_entity_id}})`.
5. Persist `stripe_transfer_id`, update `payout.status='in_transit'`.

**Webhook follow-up:**
- `transfer.paid` → flip payout to `paid`, emit `payout.paid`
- `transfer.failed` → flip to `failed`, persist `failure_reason`, emit `payout.failed`
- `transfer.reversed` → flip to `reversed`, emit `payout.reversed`. Next settlement run picks up negative `payout_line` to balance.

**Refunds.** When captured payment refunded after being included in paid payout, next settlement run inserts `payout_line` with `kind='refund'` and negative `amount`.

**LAX-stock entities** excluded entirely from settlement query — their seller-side captured payments belong to platform's own Stripe balance.

**Xero Bills at entity level:** handling `payout.paid` to create a Xero Bill against `legal_entity.xero_contact_id` and persist `payout.xero_bill_id` is **not** part of the Stripe settlement loop above; it ships in **SE-P14a** alongside Contact resolution.

---

### Group D — Admin dashboard decisions (DSE16–DSE20)

#### DSE16 — Admin URL structure

New route groups under `apps/web/src/app/admin/`:

- `(legal-entities)/legal-entities/page.tsx` — list with filters (kind, subkind, status, is_lax_managed, name search). URL query params for shareable links.
- `(legal-entities)/legal-entities/pipeline/page.tsx` — Kanban-style status board.
- `(legal-entities)/legal-entities/[id]/page.tsx` — detail page.
- `(legal-entities)/legal-entities/[id]/documents/page.tsx` — document review with inline preview.
- `(legal-entities)/legal-entities/[id]/members/page.tsx` — member management.
- `(payouts)/payouts/page.tsx` — settlement queue tabs.
- `(payouts)/payouts/[id]/page.tsx` — payout detail with line items, fees, refs.
- `(artists)/artists/page.tsx` — list with kind/status/search filters.
- `(artists)/artists/review/page.tsx` — pending review queue.
- `(artists)/artists/[id]/page.tsx` — detail with merge UX.
- `audit/page.tsx` — audit log viewer.

Verification queue widgets added to existing `apps/web/src/app/admin/page.tsx` (DSE20).

#### DSE17 — New platform capabilities

Extend `packages/types/src/role-policy.ts` with new capabilities (broader set scheduled in SE-P13 / DSE35):

- `legal_entity.read` (administrator)
- `legal_entity.write` (administrator)
- `legal_entity.approve` (administrator only — terminal status transition)
- `legal_entity.archive` (administrator only — terminal status transition)
- `artist.read` (administrator + specialist)
- `artist.review` (administrator + specialist)
- `artist.merge` (administrator only — destructive)
- `payout.read` (administrator + finance-role members via `legal_entity_member` for own entity, enforced at service layer)
- `payout.process` (administrator only)
- `payout.reverse` (administrator only — destructive)

Existing `finance.read / finance.write` capabilities remain. New ones layer on top. All admin routes gated by `requireCapability(...)` middleware (existing pattern).

`legal_entity_member.role` is orthogonal to platform capabilities (Q12).

#### DSE18 — Typed-confirmation pattern for destructive admin actions

New shared component `apps/web/src/components/admin/typed-confirmation-dialog.tsx`. Required for:

- Reject legal entity ("Type **REJECT** to confirm")
- Archive legal entity ("Type **ARCHIVE Acme Gallery** to confirm")
- Remove member with role in {owner, admin}
- Reverse payout
- Merge artist ("Type **MERGE INTO Banksy** to confirm")
- Demote primary admin (paired with selecting new primary admin)

shadcn-compatible `Dialog` + `Input` with case-sensitive equality check; submit disabled until exact match.

#### DSE19 — Audit-log viewer reads from `domain_events`

`/admin/audit` page is a read view over `domain_events`. Filters: actor user, affected aggregate, event type (multi-select), time range. Export to CSV via server action.

Every admin mutation MUST write a `domain_events` row in same transaction as entity write (existing D8 invariant — non-negotiable). Reason text supplied by admin captured in `payload.reason`.

Entity detail pages show a "Recent activity" timeline pulled from `domain_events` filtered by `aggregate_type = 'legal_entity' AND aggregate_id = $id`, last 50 events.

#### DSE20 — Verification queue widgets on `/admin` home

Server component on existing `apps/web/src/app/admin/page.tsx` aggregating:

- `SELECT count(*) FROM legal_entity WHERE status IN ('docs_received','under_review')` → "Entities pending your review"
- `SELECT count(*) FROM artist_profile WHERE status = 'pending'` → "Artists pending approval"
- `SELECT count(*) FROM payout WHERE status = 'failed'` → "Payouts requiring action"
- `SELECT count(*) FROM legal_entity WHERE jsonb_array_length(stripe_connect_requirements_currently_due) > 0` → "Stripe Connect issues"
- `SELECT count(*) FROM kyc_verification WHERE status IN ('processing','requires_input') AND created_at < now() - interval '24 hours'` → "Stale identity sessions"
- `SELECT count(*) FROM legal_entity_document WHERE review_status = 'pending'` → "Documents awaiting review"

Each widget is a clickable card linking to relevant admin list with right filter pre-applied via URL query params.

---

### Group E — Artist registry decisions (DSE21–DSE25)

#### DSE21 — `artist_profile` extended in place

Keep existing `packages/db/src/schema/artist-profiles.ts` as the single artist record. Extend rather than introduce parallel table. New columns in `0027`:

- `kind text NOT NULL DEFAULT 'artist'` — values `artist | maker | brand | marque`
- `status text NOT NULL DEFAULT 'pending'` — values `pending | approved | rejected | merged_into`
- `merged_into_artist_id uuid REFERENCES artist_profile(id) ON DELETE SET NULL`
- `created_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL`
- `reviewed_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL`, `reviewed_at timestamptz`, `review_notes text`
- `rejection_reason text`
- Rename `owner_user_id` → `owner_legal_entity_id uuid REFERENCES legal_entity(id) ON DELETE SET NULL` (dual-write window per DSE6)

**Indexes:**
- `(status)` — admin pending-review queue
- `(kind, status)` — artist list filters
- Partial `(merged_into_artist_id) WHERE merged_into_artist_id IS NOT NULL` — for resolveArtist redirects
- `(owner_legal_entity_id)` — replaces existing owner_user_id index after dual-write

**Constraint:** `CHECK (status != 'merged_into' OR merged_into_artist_id IS NOT NULL)` — merged records must point somewhere

**Auto-creation rule (DSE-Y):** `artist_profile` is NOT auto-created when a `subkind='artist'` legal_entity is created. Created on-demand at first lot reference or self-claim. Avoids polluting registry with empty placeholders.

#### DSE22 — `artist_alias` table for synonyms and dedup hints

New file `packages/db/src/schema/artist-aliases.ts`. Supports search-existing-or-create-pending UX without false negatives.

**Columns:**
- `id uuid PK`
- `artist_profile_id uuid NOT NULL REFERENCES artist_profile(id) ON DELETE CASCADE`
- `alias text NOT NULL` — lowercased, trimmed; for trigram search
- `kind text NOT NULL DEFAULT 'synonym'` — values `synonym | misspelling | translation | birth_name`
- `created_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL`, `created_at timestamptz DEFAULT now() NOT NULL`

**Indexes:**
- Unique `(artist_profile_id, alias)`
- `USING gin (alias gin_trgm_ops)` — powers fuzzy "did you mean…" search

**`pg_trgm` extension (M3).** First Postgres extension in repo. `0027` runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` as the privileged owner connection (`DATABASE_URL_OWNER`) BEFORE creating the trigram index. Documented in `docs/BOOTSTRAP.md`. Without `CREATE EXTENSION` first, migration hard-fails.

**Backfill** at migration: for every existing `artist_profile`, insert `(profile_id, lower(display_name), 'synonym')`.

#### DSE23 — `lot.artist_id` column + three-pass backfill

Add `lot.artist_id uuid REFERENCES artist_profile(id) ON DELETE RESTRICT` in `0027` as nullable. ON DELETE RESTRICT prevents losing catalogue link silently.

Add `lot.artist_review_required boolean NOT NULL DEFAULT false` to flag lots referencing pending artists.

**Three-pass backfill (DSE-Z).** Replaces single-script approach. Each pass is its own script under `apps/api/src/scripts/backfill-lot-artist-id/` and is **gated on SE-P5 being live**.

- **Pass 1 — audit, no writes.** Script `pass-1-audit.ts` produces CSV at `tmp/lot-artist-backfill-audit.csv` classifying every existing `marketing_details->>'sellerArtistId'` and `marketing_details->>'artistNote'` value into:
  - `clean_artist_profile_id` — value resolves to existing `artist_profile.id` with `status='approved'`
  - `clean_text_match` — string uniquely matches `display_name` or `artist_alias.alias` (case-insensitive)
  - `text_no_match` — string with no matching profile (Pass 2 creates pending artist)
  - `ambiguous_text` — matches multiple profiles (Pass 3 admin queue)
  - `value_is_user_id` — value resolves to user.id, not artist_profile.id (Pass 3)
  - `corrupt` — doesn't parse / dangling reference (Pass 3)

- **Pass 2 — high-confidence writes.** Idempotent (safe to re-run). For `text_no_match`, creates `artist_profile` with `status='pending'`. Sets `lot.artist_id` + `lot.artist_review_required=true`.

- **Pass 3 — admin-routed.** Writes ambiguous cases to new `admin_review_task` table. Admin works through queue at `/admin/lots/artist-backfill-review`.

**Capacity planning:** plan for 10–30% of lots ending up in Pass 3.

**Hard sequencing constraint:** Pass 1 cannot run before SE-P5 is live (artist_alias table needs alias backfill from DSE22; admin review queue needs to exist).

JSON keys `marketing_details.sellerArtistId` and `marketing_details.artistNote` dropped in `0029`. Pass 3 must be drained to zero before `0029` ships.

#### DSE24 — Artist merge transaction semantics

Merge operation is atomic and reversible-by-admin-only.

In **one transaction:**
- `UPDATE artist_profile SET status = 'merged_into', merged_into_artist_id = $canonical, reviewed_by_user_id = $admin, reviewed_at = now() WHERE id = $duplicate`
- `UPDATE lot SET artist_id = $canonical WHERE artist_id = $duplicate`
- `UPDATE artist_alias SET artist_profile_id = $canonical WHERE artist_profile_id = $duplicate`
- `INSERT INTO artist_alias (artist_profile_id, alias, kind, created_by_user_id) VALUES ($canonical, lower($duplicate.display_name), 'synonym', $admin)` — preserve merged name as searchable alias
- Emit `artist.merged` event with `{canonicalId, duplicateId, lotsAffected, aliasesMerged}`

**Resolution helper at read time.** `resolveArtist(id)` follows `merged_into_artist_id` until terminal. Old code holding duplicate UUID still resolves correctly.

**Reversibility.** No automated unmerge. Reversing requires admin runbook intervention (manually flip status back, re-point lots).

#### DSE25 — Pending-artist gating on lot publish

New invariant in lot service: lot cannot transition `draft → scheduled` if `lot.artist_review_required = true` AND referenced artist's `status != 'approved'`.

**UX:** lot edit page shows yellow banner "Artist '{display_name} (pending)' awaits admin review — lot cannot be scheduled" until cleared. Admin with `artist.review` capability sees "Review now" link.

Artist approval currently emits `artist.reviewed` with `payload.status = 'approved'`; the projector also accepts `artist.approved` if that explicit event is added later.

When `artist.approved` event fires, worker projector `apps/worker/src/projectors/clear-artist-blocks.ts` clears `lot.artist_review_required = false` for all lots referencing that artist.

When `artist.merged` event fires, same projector recomputes `artist_review_required` for affected lots (now pointing to canonical, which may be approved → clears flag, or pending → keeps it).

---

### Group F — Cross-cutting decisions (DSE26–DSE30)

#### DSE26 — Acting context: cookie + revalidation + banner

Cookie `acting_legal_entity_id`, scoped `.lax.bid`. Helper `apps/web/src/lib/legal-entity/acting-context.server.ts`:
- `getActingLegalEntity(): Promise<LegalEntitySummary | null>` — reads cookie, validates active membership, falls back to user's individual entity if cookie invalid/stale. Always non-null for authenticated users.

Web client sends `X-Legal-Entity-Id: <uuid>` header on entity-scoped API requests.

Middleware `apps/api/src/middleware/legal-entity-context.ts`:
- Reads header, looks up `legal_entity_member WHERE user_id = $userId AND legal_entity_id = $headerId AND removed_at IS NULL`
- Returns 403 `legal_entity_membership_invalid` if no row
- Sets `c.set('actingLegalEntityId')`, `c.set('actingMemberRole')`

Banner `apps/web/src/components/layout/acting-as-banner.tsx` — sticky in top nav for users with multiple entities; hidden when user has only individual entity.

**Same entity across tabs** (cookie-scoped) — documented v1 constraint.

**First-switch tooltip (M2).** First time user with >1 entity opens switcher, show one-time tooltip "This applies across all your tabs." Tracked via `user.has_seen_acting_context_tooltip`. Server action `markActingContextTooltipSeen()` flips column to true.

#### DSE27 — Anti-shilling SQL helper

New file `apps/api/src/lib/anti-shilling.ts` exposes `assertCanBidAs(buyerLegalEntityId, lot): Promise<Result<void, AntiShillingError>>`.

Implementation: SQL from Q4 wrapped in Drizzle query. Cached per request via `(buyer, seller)` pair. Platform `administrator` users bypass via same pattern as `requireBuyerRoleUnlessAdministrator`.

Existing client-side `apps/web/src/lib/bid/policies/seller-own-lot.policy.tsx` rewritten to call new server helper. Policy still returns same `BidPolicyDecision` shape.

#### DSE28 — Notification routing rules

New file `apps/api/src/services/notification-routing.ts` exports static map:

- `lot.sold` → roles `{owner, admin, consignor, finance}`
- `lot.unblocked_for_publish` → `{owner, admin, consignor}`
- `payout.processed` → `{owner, admin, finance}`
- `payout.failed` → `{owner, admin, finance}` + admin dashboard widget
- `legal_entity.member_invited` → `{owner, admin}`
- `legal_entity.docs_requested` → `{owner, admin}`
- `legal_entity.review_started` → `{owner, admin}`
- `legal_entity.approved | restricted | rejected` → `{owner, admin}`
- `legal_entity.archived` → `{owner, admin}`
- `bid.outbid` (entity acting as buyer) → `{owner, admin, finance, buyer_agent}`
- `bid.lot_won` (entity acting as buyer) → `{owner, admin, finance, buyer_agent}` + payment-required prompt to `{owner, admin, finance}`
- `payment.captured` → `{owner, admin, finance}` (both buyer and seller)

**Send-time recipient resolution (M1).** Resolution happens at send-time using current `legal_entity_member` snapshot, NOT at enqueue time. The `email_outbox` row carries `legal_entity_id + event_type + event_payload`; worker queries members at dispatch time.

Members added between event emission and email send still receive notification. Members removed in that window also still get it (race-window grace, accepted trade-off).

Per-user dedupe: if user is member of two entities both interested in same event, dispatcher fires twice (different contexts = different inbox items). Each notification carries `actingLegalEntityId` so inbox UI shows context.

#### DSE29 — Better Auth invitation reuse for member invites

Existing `packages/db/src/schema/user-invitation.ts` extended in `0027` with two nullable columns:
- `target_legal_entity_id uuid REFERENCES legal_entity(id) ON DELETE CASCADE`
- `target_legal_entity_member_role text` (reuses `legal_entity_member_role` enum)

When `target_legal_entity_id IS NOT NULL`, invitation is a member invite. On accept, system inserts `legal_entity_member` row with target role + entity.

Existing `target_role` (platform-level) and new `target_legal_entity_member_role` (entity-scoped) coexist. Most member invites set the latter, leave former at `'client'`.

No new email template needed — existing invitation template gains `{legal_entity_name}` variable (empty for platform-role invites).

#### DSE30 — `packages/types` and `packages/validators` new modules

- `packages/types/src/legal-entity.ts` — `LegalEntity`, `LegalEntityKind`, `LegalEntitySubkind`, `LegalEntityStatus`, `LegalEntityMember`, `LegalEntityMemberRole`, `LegalEntitySummary` (lightweight shape for switcher: `id, displayName, kind, subkind, status, role, isPrimaryAdmin`)
- `packages/types/src/payout.ts` — `Payout`, `PayoutStatus`, `PayoutLine`, `LegalEntityPayoutMethod`
- `packages/types/src/artist.ts` — extend with `ArtistKind`, `ArtistStatus`, `ArtistAlias`. Existing `Artist` gains `status, kind, mergedIntoArtistId, ownerLegalEntityId`
- `packages/validators/src/legal-entity.ts` — Zod schemas for create / update / member-invite / status-transition (each transition has own schema with required `reason: z.string().min(10)` for destructive transitions)
- `packages/validators/src/payout.ts` — payout-method config + admin reverse-payout reason

Existing types touched by seller pivot (`Lot, ItemSubmission, Sale, Payment, Bid`) gain `legalEntityId: string` field. Legacy `sellerId` stays as `@deprecated` until `0029`.

`Lot` also gains: `buyerLegalEntityId: string | null` (winner's entity at win time), `artistId: string | null` (DSE23), `artistReviewRequired: boolean` (DSE25).

`Bid` gains: `buyerLegalEntityId: string`, `placedByUserId: string` (preserves bidderId semantics).

`Payment` gains: `buyerLegalEntityId: string`, `sellerLegalEntityId: string`.

---

### Group G — Follow-on work (DSE31–DSE36)

These decisions are agreed and **scheduled** into §3 phases SE-P13, SE-P14a, and SE-P14–SE-P16 (replacing the earlier "DEFERRED" placeholder). Each DSE below points at its implementing phase; see that phase for verification gates and rollback.

#### DSE31 — Domain event PII policy — **scheduled into SE-P15**

**Status:** policy documented here; formal implementation ships with SE-P15 (bundled with payout statements and audit export behaviour).

Payloads minimize PII by default. Include only references (`userId`, `legalEntityId`, `paymentId`) — consumers join to resolve PII at projection time.

**Exceptions where PII is included in payload directly:**
- `legal_entity.member_invited` — invitee email (consumer is email worker; alternative would require last-mile join)
- `payment.captured` — buyer's display name and email at capture time (Xero invoice records are point-in-time)
- `kyc.verified` — verified name and DOB (kyc_verification table is only persistence)

For every other event type, payload contains references only. New event types follow same rule. Documented in `docs/architecture/04-domain-events.md` (added in SE-P12).

PII-redaction helper `redactDomainEventPayload(event)` added to `apps/worker/src/projectors/lib/` for use in audit log exports — even when payload contains PII, audit log viewer shows redacted form unless admin has explicit `audit.read_pii` capability (added in SE-P13 / DSE35).

#### DSE32 — Invoice and bill addressing for corporate buyers — **SE-P14**

**Status:** `InvoiceAddressingService` + `payment-invoice` email template + Xero `invoiceAddresses` (when `XERO_USE_LEGAL_ENTITY_CONTACT`) are on disk (2026-05-07).

Resolution rule for invoice "Bill To" field:

**If `payment.buyer_legal_entity_id` references `kind='organisation'`:**
- Bill-to name: `legal_entity.legal_name` (or `display_name` if `legal_name IS NULL`)
- Bill-to address: `legal_entity_address WHERE address_type IN ('billing', 'both', 'registered_office')` ordered by that preference
- Tax line: `VAT Reg: {legal_entity.vat_number}` if non-null

**If `kind='individual'`:**
- Bill-to name: `user.name` (resolved via `legal_entity.created_by_user_id → user.name`)
- Bill-to address: `user_address WHERE is_default = true`
- No VAT line

Implementation: invoice template at `packages/email/src/templates/payment-invoice.tsx` consumes `BillToContext` shape resolved server-side. Resolver lives at `apps/api/src/services/invoice-addressing.ts`. Xero invoice creation uses same resolver to set Xero's bill-to fields consistently.

#### DSE33 — Payout statements — **scheduled into SE-P15**

**Status:** PDF statements and `statement_url` column ship in SE-P15 (with DSE31 policy formalisation in the same phase).

- Each `payout` row generates downloadable PDF at `/dashboard/legal-entities/{id}/payouts/{payoutId}/statement.pdf`
- Statement contains: payout period, gross amount, contributing payments (with lot reference + buyer name where allowed), platform fee with rate breakdown, Stripe fee, net amount, transfer reference, settlement date
- Generation lazy on first request, cached after
- Storage: cached statement persists in Spaces under `payout-statements/{legal_entity_id}/{payout_id}.pdf` for 7 years (UK accounting retention)
- Admin equivalent at `/admin/payouts/{id}/statement.pdf` includes additional fields (entity legal name, VAT number, Xero bill ID)

**Schema impact:** `payout` table needs `statement_url text` column (nullable; populated lazily by statement-generation worker).

**Out of scope for v1** (defer to v2): aggregate per-period reports, downloadable CSV across multiple payouts, custom date-range statements, scheduled statement emails.

Implementation: PDF generation lives in `apps/worker/src/jobs/generate-payout-statement.ts` (BullMQ job) so it doesn't block the settlement worker's main path.

#### DSE34 — Admin impersonation safety — **scheduled into SE-P16**

**Status:** ships in SE-P16 after `audit.read_pii` exists (SE-P13). Current middleware validates membership but no impersonation timeout, banner, or events exist yet.

When platform `administrator` has `acting_legal_entity_id` set to entity they are NOT a member of, treat as **impersonation** rather than ordinary acting-context:

- **Hard time limit:** 4 hours from moment of switching. After that, cookie rejected; admin must explicitly re-impersonate (audit event re-emitted).
- **Audit trail:** every action during impersonation emits domain event with new `is_admin_impersonation: true` flag in payload. New event types `admin.impersonation_started` and `admin.impersonation_ended` (auto-emitted on switch and on timeout).
- **UX:** admin UI shows persistent **red banner** across entire dashboard while impersonation active: "Impersonating Acme Gallery. Auto-ends in {N} minutes. [End now]" — non-dismissable, fixed top.
- **Notification to actual entity members:** when impersonation starts, email enqueued (template `admin-impersonation-notice`) to all members with role in {owner, admin, primary_admin} explaining LAX support is investigating their account. Includes admin's name, contact email, time window.
- **URL/document tags:** admin pages render entity context with "(impersonated)" tag in URLs and document titles so screenshots taken during impersonation are unambiguous.

Implementation: middleware in `apps/api/src/middleware/require-legal-entity-context.ts` (and related acting-context cookie handling) detects impersonation case and adds flag to events. 4-hour timeout enforced by storing timestamp in cookie alongside entity id.

**Schema impact:** `domain_events` index on `(payload->>'is_admin_impersonation')::boolean WHERE (payload->>'is_admin_impersonation')::boolean IS TRUE` for fast impersonation-history queries.

#### DSE35 — Capability set expansion — **scheduled into SE-P13**

**Status:** SE-P13 expanded `role-policy.ts` and rewired artist/payout admin gates. Capabilities now include `legal_entity.*`, `artist.*`, `payout.*`, and `audit.read_pii` as specified in DSE17.

**Still missing for DSE17 (SE-P17):** HTTP admin routes for legal entity **status lifecycle** (`under_review` → `connect_pending`, etc.) — capabilities exist but no transition endpoints yet (see **SE-P17** in §3).

Each capability ships with role-mapping (administrator gets all; specialist gets `artist.read | review`; finance-role members get scoped `payout.read` for own entities via service layer where noted).

#### DSE36 — Proxy bidding anti-shilling completeness — **scheduled into SE-P13**

**Status:** SE-P13 added creation-time anti-shilling, auto-bid path guard, and `bid.proxy_cancelled` domain events. **Follow-up (v1.1):** explicit **bidder notification** when a proxy is cancelled for anti-shilling (event exists; notification wiring deferred).

**Anti-shilling interaction with proxies:**
- Anti-shilling check runs at proxy creation time (rejects proxy creation if buyer-entity shares any member with seller-entity)
- AND at every automated bid the proxy generates (defense in depth — if membership graph changed between proxy creation and auto-bid, auto-bid rejected and proxy auto-cancelled)
- Auto-cancelled proxy emits `bid.proxy_cancelled` domain event with `reason='anti_shilling_violation'` — bidder push/email notification tracked as v1.1 polish

---

## §3 — Phasing (SE-P0 through SE-P21)

> **Status as of 2026-05-07:** SE-P0 through SE-P17 are **complete** (on disk,
> uncommitted). The legal-entity rollout (SE-P0 → SE-P17) is finished. **SE-P19**
> (completeness backfill) closes gaps called out in the SE-P19 implementation plan.
> **SE-P20** (Round 2 security audit) is **complete** — see “Round 2 security audit summary” below.
> **SE-P21** (Round 3 launch production correctness) is **complete** — see “Round 3 scale audit summary” below.
>
> **Deferred work and follow-ups** accumulated across SE-P13–SE-P17 are
> consolidated at the end of this section — see "Deferred work and follow-ups"
> for pre-launch blockers, v1.1 items, and hygiene tasks with effort estimates.

### Round 2 security audit summary (SE-P20)

External-style review of IDOR, privilege boundaries, webhook and metrics exposure,
and data minimisation on public reads. **Closed in this round:** artist alias
mutation gated (`artist.review`); server-side `impersonation_session` validation
with structured acting cookie; Postmark webhook fail-closed + env validation in
production; finance write capabilities split with legal-entity scope on payment
capture/refund; public bid history redacted (`bidderRef`, no raw `placedByUserId`
leak); optional auth on public artist reads where appropriate; internal cron
compare uses `timingSafeEqual`; `/metrics` behind admin auth; non-Stripe webhooks
rate-limited; submission `legalEntityId` sourced from validated acting context
with **follow-up:** submissions middleware + web cookie seed default to the user’s
personal entity when the header/cookie is absent (defense in depth, legacy
callers). **Verification:** targeted API tests + `pnpm typecheck` / `pnpm test`
at repo root after each cluster.

### Round 3 scale audit summary (SE-P21)

Read-only **scale & best-practices** audit covered database hot paths, transaction
scope, Redis/BullMQ workers, webhooks, external APIs, email/PDF pipelines,
sessions, unbounded `domain_events` growth, SOLID/maintainability, errors,
logging, TypeScript strictness, tests, and configuration. **SE-P21 (launch
blocking)** shipped: **(1)** `IBidRepository.findEligibleBidsForLotClose` — one
SQL query with the same NOT EXISTS anti-shilling pattern as
`drizzle-anti-shilling.repository.ts`, used from `LotLifecycleService.finalizeLotEnding`
instead of sequential `violatesAntiShilling` calls; void path emits
`lot.voided` with `reason: no_valid_winner` and persists matching `voided_reason`.
**(2)** Redis `SET payout:settlement:lock NX EX 1800` around bulk settlement +
`DEL` in `finally`; concurrent callers get **409** `{ reason: "settlement_already_running" }`.
**Documented (no code):** `docs/runbooks/domain-events-retention.md`,
`docs/runbooks/scale-monitoring.md`. **Verification:** `pnpm typecheck`, `pnpm test`;
integration tests for `findEligibleBidsForLotClose` when `DATABASE_URL` is set;
unit tests for lifecycle batch path + settlement lock.

## Reality check (audit history)

A previous chat claimed SE-P2 → SE-P7 had been written, but a working-tree
audit found that *only* SE-P0 (schemas) and SE-P1 (types/validators/dual-
write repos/mappers) had persisted. The 2026-05-06 session re-implemented
SE-P2 → SE-P7 from scratch, with a typecheck gate between every phase.

## Phase status

| Phase | Goal | Status |
|------|------|--------|
| SE-P0 | Schema foundation, migration, eager backfill | ✅ on disk |
| SE-P1 | Repo dual-write + mapper sweep | ✅ on disk |
| SE-P2 | Acting context (cookie + header + middleware + UI switcher) | ✅ on disk |
| SE-P3 | Stripe Identity KYC (service, repo, webhook, threshold gate) | ✅ on disk |
| SE-P4 | Public submit-to-LAX organisation onboarding | ✅ on disk |
| SE-P5 | Artist registry (3-pass search, merge, review) | ✅ on disk |
| SE-P6 | Stripe Connect Express (KYB) | ✅ on disk |
| SE-P7 | Member management (invites, role changes, transfers) | ✅ on disk |
| SE-P8 | Payouts + payout lines wiring | ✅ on disk (admin/cron settlement TBD) |
| SE-P8.5 | Stripe Connect transfer reconciliation | ✅ on disk (domain event emission deferred) |
| SE-P9 | Anti-shilling rule enforcement | ✅ on disk |
| SE-P10 | Notification routing by membership role | ✅ on disk |
| SE-P11 | Read-from-new-columns flip & remove fallbacks | ✅ on disk |
| SE-P12 | Drop deprecated `user_id` columns (final cutover) | ✅ on disk |
| SE-P13 | Capability expansion + proxy anti-shilling completeness (DSE35, DSE36) | ✅ on disk |
| SE-P14a | Xero entity-level Contact + `payout.paid` Bill projection (DSE1 / DSE15 parts) | ✅ on disk |
| SE-P14 | Invoice addressing service (DSE32) | ✅ on disk |
| SE-P15 | Payout statements + domain-event PII policy (DSE33, DSE31) | ✅ on disk |
| SE-P16 | Admin impersonation safety (DSE34) | ✅ on disk |
| SE-P17 | Admin legal entity lifecycle routes (DSE17 capability wiring) | ✅ on disk |
| SE-P19 | Completeness backfill — typed destructive confirmations (DSE18), lot artist backfill + admin queue (DSE23), artist block projector (DSE25), admin issue widgets (DSE20), KYC/Connect auto-progress (Q9), Q11 event gaps | ✅ implemented |
| SE-P20 | Round 2 security hardening — artist alias IDOR, server-side impersonation sessions, Postmark fail-closed, finance write scoping, bid-history redaction, pending-artist visibility, cron timing-safe compare, metrics gate, submissions context guard, non-Stripe webhook rate limits; follow-up: personal-entity fallback + acting cookie seed | ✅ complete |
| SE-P21 | Round 3 launch production correctness — batch anti-shilling SQL at lot close, Redis distributed lock on bulk payout settlement, domain_events + scale monitoring runbooks | ✅ complete |
| SE-P18a | Money correctness — Stripe transfers, webhooks, payment-path status enforcement | Proposed |
| SE-P18b | State integrity — bid/submission gating, archive cascade, race locks, sweeper | Blocked on SE-P18a |
| SE-P18c | Operational polish — weekly cron, dashboard banner, rollback scripts | Blocked on SE-P18b |

### SE-P19 — Completeness backfill (2026-05-07)

Targeted closure of deferred “paper cuts” from the legal-entity / registry / payouts track: accidental-click safety on destructive admin actions, operational visibility (widgets + queues), artist/lot hygiene, and domain-event completeness.

**Why items were missed earlier:** parallel SE-P13–SE-P17 delivery prioritized money correctness, lifecycle HTTP, and impersonation; registry projector/backfill and typed confirmations were documented as follow-ups but not scheduled as a single gated phase.

**What shipped:**

| Cluster | Implementation summary |
|--------|-------------------------|
| **DSE18 typed confirmation** | `TypedConfirmationDialog` + server/API phrase validation for legal entity reject/archive, member remove/primary transfer, artist merge (`MERGE INTO …`), payout reverse (`REVERSE PAYOUT {uuid}`); API routes + tests. |
| **DSE25 artist projector** | Worker `clear_artist_blocks` projector + tests; reacts to `artist.reviewed` (approved), `artist.merged`, `artist.approved`. |
| **DSE23 lot artist backfill** | Classifier + pass 1–3 scripts (`apps/api/src/scripts/backfill-lot-artist-id/`), admin review tasks + `/admin/lots/artist-backfill-review`. |
| **DSE20 admin widgets** | Extended `/admin/metrics/finance-issues` counts + `/admin/onboarding-issues` list endpoint + admin home cards + `/admin/onboarding-issues` page. |
| **Q9 auto-progress** | Stripe Identity webhook advances `individual` entities `lead → connect_pending`, emits `kyc.verified` + `legal_entity.lifecycle_progressed`; Stripe Connect `account.updated` emits lifecycle event when `connect_pending → approved`. |
| **Q11 events** | `legal_entity.created` (org onboarding), member invite/accept/role-change events, `kyc.verified`; payout naming variance documented above. |

**Re-audit (post-implementation):**

| Item | Status |
|------|--------|
| DSE18 | **IMPLEMENTED** — typed UI + server-side phrase gates on listed mutations. |
| DSE23 | **IMPLEMENTED** — scripts + classifier tests + admin queue route/UI (operator-run scripts). |
| DSE25 | **IMPLEMENTED** — projector registered in worker runner. |
| DSE20 | **IMPLEMENTED** — metrics + onboarding issues drill-down. |
| Q9 | **IMPLEMENTED** — KYC webhook progression + Connect approval event. |
| Q11 | **IMPLEMENTED** (with payout naming variance documented; `artist.approved` remains `artist.reviewed` in registry — projector listens to both patterns). |

## What is on disk

### SE-P0 — Schema foundation

- New schemas under `packages/db/src/schema/`:
  `legal-entities.ts`, `legal-entity-members.ts`,
  `legal-entity-addresses.ts`, `legal-entity-documents.ts`, `payouts.ts`,
  `kyc.ts`, `artist-aliases.ts`, `admin-review-tasks.ts`.
- Extensions on `auth.ts` (added `kyc_status`, `kyc_verified_at`,
  `date_of_birth`, `has_seen_acting_context_tooltip` on `user`),
  `artist-profiles.ts`, `lots.ts`, `item-submissions.ts`, `payments.ts`,
  `bids.ts`, `sales.ts`, `user-invitation.ts`, `domain-events.ts`.
- `0027_legal_entity_foundation.sql` + `0027_rollback.sql`,
  `migrate-roles.ts` updated for new tables.

### SE-P1 — Repo dual-write + mapper sweep

- New types in `packages/types/src/legal-entity.ts` and
  `packages/types/src/payout.ts`. Existing types extended with optional
  `*_legal_entity_id` fields and `@deprecated` tags on the old `userId`
  fields.
- Validators in `packages/validators/src/legal-entity.ts` and
  `packages/validators/src/payout.ts`.
- Helpers: `apps/api/src/lib/legal-entity-resolution.ts` and updated
  `apps/api/src/lib/mappers.ts`.
- Dual-write logic in 5 Drizzle repositories:
  `drizzle-lot.repository.ts`, `drizzle-sale.repository.ts`,
  `drizzle-bid.repository.ts`, `drizzle-payment.repository.ts`,
  `drizzle-item-submission.repository.ts`.

### SE-P2 — Acting context

- API:
  - `services/interfaces/legal-entity-repository.ts` (`ILegalEntityRepository`,
    `ActiveMembership`).
  - `repositories/drizzle-legal-entity.repository.ts` —
    `findById`, `listActiveMembershipsForUser`, `findActiveMembership`,
    `ensurePersonalEntity`.
  - `middleware/require-legal-entity-context.ts` (`createRequireLegalEntityContext`,
    `createOptionalLegalEntityContext`, `X_LEGAL_ENTITY_ID_HEADER`,
    `LegalEntityContext` Hono variable).
  - `routes/legal-entities.ts`:
    `GET /legal-entities/me`, `GET /legal-entities/:id`,
    `POST /users/me/acting-context-tooltip`.
  - `services/user.service.ts` extended with `markActingContextTooltipSeen`.
  - `repositories/drizzle-user.repository.ts` re-implements
    `findById` (now returns `hasSeenActingContextTooltip`) and
    `updateActingContextTooltipSeen`.
- Web:
  - `lib/legal-entity/client-acting-context.ts` rewritten to align with
    canonical `LegalEntitySummary`. Cookie domain is now opt-in via
    `NEXT_PUBLIC_COOKIE_DOMAIN`.
  - `lib/legal-entity/acting-context.server.ts` — `resolveActingContext`,
    `getActingLegalEntityHeader`.
  - `lib/legal-entity/acting-context.actions.ts` —
    `switchActingLegalEntity`, `dismissActingContextTooltip`.
  - `components/layout/acting-as-banner.tsx` (server component).
  - `components/layout/legal-entity-switcher.tsx` (client component using
    `Popover` + `Command`).
  - `components/layout/acting-as-tooltip.tsx` (first-time hint).
- Container & app wiring: `legalEntityRepository` is exposed; routes are
  mounted under `/legal-entities` and `/users` with rate limiting.

### SE-P3 — Stripe Identity KYC

- Env: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_IDENTITY_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`,
  `KYC_THRESHOLD_AMOUNT`, `KYC_THRESHOLD_CURRENCY`. Stripe SDK installed.
- API:
  - `services/interfaces/kyc-repository.ts`,
    `services/interfaces/kyc-service.ts` (with `KycRequiredError` /
    `KycNotConfiguredError`).
  - `repositories/drizzle-kyc.repository.ts` — full CRUD + pending exposure
    (active winning bids on `lot.status in ('active','ended')` + payments
    in `('pending','authorized')` + submissions in
    `('submitted','under_review')`).
  - `services/kyc/stripe-kyc.service.ts` — `createSession`,
    `getStatus` (with KYC threshold), `handleWebhook`,
    `enforceThreshold`. Maps Stripe Identity statuses to
    `KycVerification.status` and `user.kyc_status`.
  - `middleware/require-kyc.ts` returns 402 + `summary` on threshold.
  - `routes/kyc.ts`: `GET /kyc/status`, `GET /kyc/session/latest`,
    `POST /kyc/session`.
  - `routes/webhooks/stripe.ts`: `POST /webhooks/stripe/identity`
    delegates to `kycService.handleWebhook`.

### SE-P4 — Public submit-to-LAX organisation onboarding

- Validators: `createOrganizationSchema`, `checkOrgNameSchema`,
  `orgRequirementsParamsSchema`, `publicOrganisationSubkinds`.
- API:
  - `services/interfaces/organization-onboarding.ts` and
    `services/organization-onboarding.service.ts` — slug generation, per-
    subkind requirements (`gallery`, `dealer`, `estate`, `company`,
    `charity`, `institution`, `other`), idempotent personal-entity
    handling, primary admin membership creation.
  - `routes/organizations.ts`: `GET /organizations/subkinds`,
    `GET /organizations/requirements/:subkind`,
    `GET /organizations/check-name`, `POST /organizations`.
- Web:
  - `lib/legal-entity/organization-onboarding.actions.ts` —
    `checkOrgNameAction`, `createOrganizationAction`.
  - `app/(marketing)/onboarding/organisation/page.tsx` (server-rendered;
    redirects unauthenticated users to login).
  - `components/legal-entity/organization-onboarding-form.tsx` — multi-step
    form with debounced name availability and address fields.

### SE-P5 — Artist registry

- API:
  - `services/interfaces/artist-registry.ts` and
    `services/artist-registry.service.ts`:
    `search` (3-pass: exact slug/displayName → exact alias → fuzzy via
    `pg_trgm` similarity ≥ 0.4), `proposeMatches`, `findById`,
    `findBySlug`, `create` (pending), `checkNameAvailability`,
    `merge` (re-points aliases + lots, archives source artist, writes
    `admin_review_task` audit row), `review` (approve/reject;
    clears `lot.artist_review_required` on approve), `addAlias`.
  - `routes/artists.ts`: `GET /artists/search`,
    `POST /artists/propose-matches`, `GET /artists/by-slug/:slug`,
    `GET /artists/check-name`, `GET /artists/:id`, `POST /artists`,
    `POST /artists/:id/aliases`, `POST /artists/:id/merge`,
    `POST /artists/:id/review`.
- Web:
  - `lib/utils/debounce.ts` generic debounce.
  - `components/artists/artist-search.tsx` (client) with debounced search
    and "Create artist" affordance.
  - `components/artists/create-artist-dialog.tsx` (client) with name
    availability check.

### SE-P6 — Stripe Connect Express

- API:
  - `services/interfaces/stripe-connect.ts` and
    `services/stripe/stripe-connect.service.ts`: `ensureAccount`
    (idempotent), `getStatus` (cached on the entity row),
    `createOnboardingLink`, `createDashboardLink`, `handleWebhook`
    (`account.updated`, `capability.updated`).
  - `routes/stripe-connect.ts`: `GET /stripe-connect/status`,
    `POST /stripe-connect/account`, `POST /stripe-connect/onboarding-link`,
    `POST /stripe-connect/dashboard-link`. All require
    `X-Legal-Entity-Id` and a member role (owner/admin for write,
    owner/admin/finance for dashboard).
  - `routes/webhooks/stripe.ts` `POST /webhooks/stripe/connect` delegates
    to `stripeConnectService.handleWebhook`.

### SE-P7 — Member management

- API:
  - `services/interfaces/member-management.ts` (with `MemberPermissionError`)
    and `services/member-management.service.ts`:
    `listMembers`, `inviteMember` (existing user → instant active member;
    new user → entity-scoped `user_invitation` row),
    `acceptInvite`, `updateRole`, `removeMember`, `transferPrimaryAdmin`.
  - `routes/legal-entity-members.ts` mounted under `/legal-entities`:
    `GET /members`, `POST /members`, `PATCH /members/:memberId`,
    `DELETE /members/:memberId`,
    `POST /members/transfer-primary-admin`,
    `POST /invitations/accept` (no entity context required).
- Web:
  - `lib/legal-entity/member-management.actions.ts` server actions.
  - `components/legal-entity/member-list.tsx` and
    `components/legal-entity/invite-member-form.tsx` client components.
  - **Wired**: `app/dashboard/team/page.tsx` (uses `resolveActingContext` +
    member list) and `app/dashboard/layout.tsx` now passes
    `<ActingAsBanner />` into `AppShell` via a new `headerSlot` prop.
  - **Nav**: `app-shell-nav.ts` selling workspace exposes a "Team" entry
    (`/dashboard/team`) and a parent breadcrumb label.

### SE-P8 — Payouts + payout lines

- API (interfaces in `services/interfaces/payout.ts` and
  `services/interfaces/payout-repository.ts`):
  - `services/payout.service.ts` — `listForLegalEntity`, `getById`,
    `previewPending` (sum unlinked captured payments), `adminList`,
    `createSettlement` (rolls captured payments into a payout + sale
    lines), `addAdjustment` (positive or negative manual line, recomputes
    totals), `markPaid` (transitions `scheduled`/`in_transit` → `paid`,
    records Stripe transfer id and `processedAt`).
  - `repositories/drizzle-payout.repository.ts` implements
    `IPayoutRepository`, including a Drizzle SQL helper that surfaces
    captured payments not yet referenced by any `payout_line`.
  - Routes:
    - `routes/payouts.ts` exports `createPayoutRoutes` (seller, scoped to
      acting entity: `GET /payouts`, `GET /payouts/preview-next`,
      `GET /payouts/:payoutId`) and `createAdminPayoutRoutes` (admin /
      finance: `GET /admin/payouts`, `POST /admin/payouts/run-settlement`,
      `POST /admin/payouts/:id/adjustments`,
      `POST /admin/payouts/:id/mark-paid`). Admin gate uses the existing
      `finance.write` capability via a new `requireFinanceWriteMw`.
  - Container wiring: `payoutRepository` + `payoutService` instantiated and
    exported from `container.ts`. `app.ts` mounts both route groups under
    `/payouts` and `/admin/payouts` with the standard rate-limit middleware.
- Web:
  - `app/dashboard/seller/payouts/page.tsx` rewritten — now uses
    `resolveActingContext` to look up the acting entity, fetches both
    `/payouts` and `/payouts/preview-next` in parallel, and renders a
    "next payout" tile + a chronological list of past/scheduled payouts
    with status badges and per-currency formatting.
  - `app/admin/(finance)/payouts/page.tsx` added for the finance/admin
    shell:
    - status + legal-entity filters over `GET /admin/payouts`
    - KPI cards for scheduled / in-transit / paid / visible net
    - manual `POST /admin/payouts/run-settlement` form (one legal entity
      at a time)
    - per-payout adjustment form (`POST /admin/payouts/:id/adjustments`)
    - per-payout mark-paid form (`POST /admin/payouts/:id/mark-paid`)
  - `lib/admin/payout.actions.ts` added with server actions for the three
    admin mutations, including `revalidatePath("/admin/payouts")` and
    redirect-based success/error messages.
  - `lib/data/http/admin.server.ts` now exposes `getAdminPayoutList` and
    an `AdminPayoutRow` parser for the admin API payload.
  - `components/layout/app-shell-nav.ts` now exposes `/admin/payouts` in
    both administrator and accountant shells.
- Tests:
  - `services/payout.service.test.ts` (12 cases): preview aggregation,
    create-settlement no-op + line generation, cross-entity scope guard,
    adjustment positive/negative recompute, `markPaid` terminal-state
    guards, transfer-id propagation.
- SE-P8.5 reconciliation:
  - `services/interfaces/payout.ts` adds
    `StripeTransferReconciliationInput` and
    `IPayoutService.reconcileStripeTransfer`.
  - `services/interfaces/payout-repository.ts` adds
    `findByStripeTransferId` and `reconcileStripeTransfer`.
  - `repositories/drizzle-payout.repository.ts` persists
    `stripe_transfer_id`, status, optional `stripe_fee`, `processed_at`,
    and `failure_reason`; when `stripe_fee` is supplied it recomputes
    `net_amount = gross_amount - platform_fee - stripe_fee`.
  - `services/stripe/stripe-connect.service.ts` now handles
    `transfer.created`, `transfer.updated`, `transfer.paid`,
    `transfer.failed`, and `transfer.reversed`. It prefers
    `transfer.metadata.payoutId` for first reconciliation (so
    `transfer.created` can arrive before `stripe_transfer_id` is stored),
    falls back to transfer-id lookup in the payout service, extracts a
    major-unit fee from an expanded `balance_transaction.fee` when Stripe
    includes it, and returns `processed: false` when no local payout is
    matched.
  - `container.ts` now constructs `payoutService` before
    `StripeConnectService` and injects it into the Connect service.
  - New tests:
    - `services/payout.service.test.ts` grew to 15 cases covering
      missing transfer lookup, metadata lookup, `created → in_transit`,
      and `paid → paid` with `processedAt`.
    - `services/stripe/stripe-connect.service.test.ts` adds 2 cases for
      Connect webhook delegation (fee extraction + metadata) and the
      no-local-payout path.
- Out of scope for this iteration (deferred):
  - Cron / scheduled job that fans `createSettlement` across all
    entities — admin route `POST /admin/payouts/run-settlement` is the
    seam where the eventual job will plug in.
  - Domain event emission (`payout.paid`) — the codebase has a
    `DomainEventPublisher`, but architecture docs still state no service
    emits outbox events yet. Keep payout event emission with the broader
    domain-events wiring work rather than making payouts the first special
    case.

### SE-P9 — Anti-shilling rule enforcement

- API enforcement:
  - `services/interfaces/anti-shilling.ts` defines the anti-shilling guard
    contract used by bid placement.
  - `repositories/drizzle-anti-shilling.repository.ts` checks whether the
    bidder is an accepted, active member of the lot's `sellerLegalEntityId`.
  - `services/bid.service.ts` rejects direct bids from users who share the
    seller legal entity, returning the existing
    `"Seller cannot bid on own lot"` bid error so current web bid-error
    mapping continues to work.
  - Proxy auto-bid resolution now skips candidates who share the seller
    legal entity, preventing pre-existing max ceilings from generating a
    seller-side bid after membership changes.
  - `container.ts` wires `DrizzleAntiShillingRepository` into `BidService`.
- Tests:
  - `services/bid.service.test.ts` now covers direct shared-entity denial,
    allowed bids from unrelated buyers, and proxy auto-bid candidate
    skipping.

### SE-P10 — Notification routing by membership role

- API routing:
  - `services/interfaces/legal-entity-notification-recipients.ts` defines
    role-based audiences: seller (`owner`, `admin`, `consignor`), finance
    (`owner`, `admin`, `finance`), and admin (`owner`, `admin`).
  - `repositories/drizzle-legal-entity-notification-recipient.repository.ts`
    reads accepted, active members for a legal entity / audience pair.
  - `services/legal-entity-notification-routing.ts` dedupes legal-entity
    recipients and falls back to the legacy user id when no legal-entity
    recipients are available during the dual-write window.
  - `services/lot.service.ts` now sends lot-cancelled seller notices to
    seller-audience members of `lot.sellerLegalEntityId`.
  - `services/item-submission.service.ts` now sends submission approved /
    rejected notices to seller-audience members of the submission legal
    entity.
  - `services/payment.service.ts` still notifies the buyer on capture and
    additionally notifies finance-audience members of the seller legal
    entity.
  - `container.ts` wires the recipient repository into the lot, item
    submission, and payment services.
- Tests:
  - Added routing tests for role matrices, dedupe, and legacy fallback.
  - Expanded lot-service, item-submission-service, and payment-service tests
    for seller / finance membership fan-out.

### SE-P11 — Read-from-new-columns flip

- API read flip:
  - `apps/api/src/lib/mappers.ts` no longer falls back from
    `*_legal_entity_id` columns to legacy user-id columns when mapping
    lots, bids, item submissions, sales, or payments.
  - Mapper reads now fail fast with
    `missing_backfilled_legal_entity_id:<context>` when a required
    backfilled legal-entity id is missing, making any incomplete 0027
    backfill visible before SE-P12 drops legacy columns.
  - Write-side dual-write resolution remains in repositories for the final
    cutover phase.
- Tests:
  - `apps/api/src/lib/mappers.test.ts` covers strict legal-entity reads and
    missing-backfill failure cases across lot, bid, item submission, sale,
    and payment mappings.

### SE-P12 — Final ownership cutover

- Database/schema:
  - `packages/db/drizzle/0028_legal_entity_final_cutover.sql` sets
    replacement legal-entity ownership columns `NOT NULL` and drops
    deprecated ownership columns: `lot.seller_id`,
    `item_submission.seller_id`, `payment.seller_id`, and
    `sale.created_by`.
  - Drizzle schemas now model legal-entity ownership directly:
    `lot.sellerLegalEntityId`, `bid.buyerLegalEntityId`,
    `itemSubmission.legalEntityId`, `payment.buyerLegalEntityId`,
    `payment.sellerLegalEntityId`, and `sale.createdByLegalEntityId` are
    required at the database boundary.
  - `packages/db/src/seed.ts` now creates deterministic personal
    `legal_entity` and `legal_entity_member` rows and seeds catalog,
    submission, bid, sale, and payment rows through legal-entity ids.
- API cutover:
  - Dual-write resolution via `resolveUserIndividualEntity` was removed from
    lot, sale, bid, payment, and item-submission repositories.
  - Repository write contracts now require legal-entity ids at the call
    boundary; legacy user ids remain only where they are active human audit
    or payment-user fields (`bid.bidder_id`, `lot.winner_id`,
    `payment.buyer_id`).
  - Bid placement now carries both `placedByUserId` and
    `buyerLegalEntityId`; ending a Dutch / buy-it-now lot writes both the
    human winner and winning legal entity.
  - Submission create/list/get/update flows now authorize against
    `legalEntityId`; approval creates lots with `sellerLegalEntityId`.
  - KYC pending exposure now counts seller submissions through the
    submission legal entity instead of `item_submission.seller_id`.
- Web compatibility:
  - Public artwork/archive, admin, watchlist, bid panel, home/artwork view
    models, and admin lot defaults now tolerate final-cutover payloads where
    legacy seller/bidder aliases are absent.
- Tests:
  - Updated bid, item-submission, lot-lifecycle, sale-service, and mapper
    fixtures/assertions to use final-cutover legal-entity write shapes.

### SE-P2 / SE-P3 / SE-P5 / SE-P7 / SE-P8 / SE-P9 / SE-P10 / SE-P11 / SE-P12 — Vitest coverage added

| File | Cases |
|------|-------|
| `apps/api/src/middleware/require-legal-entity-context.test.ts` | 7 |
| `apps/api/src/services/kyc/stripe-kyc.service.test.ts` | 12 |
| `apps/api/src/services/artist-registry.service.test.ts` | 7 |
| `apps/api/src/services/member-management.service.test.ts` | 7 |
| `apps/api/src/services/payout.service.test.ts` | 15 |
| `apps/api/src/services/bid.service.test.ts` | 12 |
| `apps/api/src/services/legal-entity-notification-routing.test.ts` | 3 |
| `apps/api/src/services/lot.service.test.ts` | 5 |
| `apps/api/src/services/item-submission.service.test.ts` | 5 |
| `apps/api/src/services/payment.service.test.ts` | 1 |
| `apps/api/src/lib/mappers.test.ts` | 2 |

These exercise the middleware contract (auth gate, missing header,
membership lookup, optional fall-through), KYC threshold logic + Stripe
webhook signature validation, the 3-pass artist search (exact → alias →
fuzzy with dedupe) and merge sequencing (alias re-point → alias insert →
lot re-point → mark merged → admin task), the `transferPrimaryAdmin`
demote-then-promote ordering required by the `legal_entity_member`
partial unique index, and the payout maths (gross/fee/net rollup,
preview with no pending payments, adjustment recompute, status guards).
The SE-P9 bid tests cover legal-entity self-bid denial, unrelated buyer
allowance, and proxy auto-bid candidate skipping.
The SE-P10 notification tests cover role-audience mappings, dedupe,
fallback behavior, seller membership fan-out, and finance payment capture
fan-out.
The SE-P11 / SE-P12 mapper tests cover strict legal-entity reads and
missing-backfill fail-fast behavior; SE-P12 service tests cover legal-entity
write contracts for bids, submissions, sales, and lot lifecycle winner
updates.

### SE-P13 — Capability expansion + proxy anti-shilling completeness

- **Implements:** DSE35, DSE36.
- **Estimated:** ~1 week.
- **Depends on:** SE-P0–SE-P12 complete (post-foundation). No schema dependency beyond existing `domain_events`, `bid`, `legal_entity_member`.
- **Scope:**
  - Extend `packages/types/src/role-policy.ts` with capabilities: `legal_entity.read`, `legal_entity.write`, `legal_entity.approve`, `legal_entity.archive`, `artist.read`, `artist.review`, `artist.merge`, `payout.read`, `payout.process`, `payout.reverse`, `audit.read_pii`; map each to `UserRole` (and document where entity-scoped finance uses service-layer checks instead of platform capability).
  - Replace admin-only checks that today infer power from `user.role === "administrator"` alone with `roleHasCapability` / `createRequireCapability` middleware on the relevant routes once those routes exist (legal entity lifecycle admin APIs, artist review/merge, payout mutations, future audit export).
  - **DSE36:** In `BidService` (or equivalent), run the same anti-shilling guard when a proxy / max-auto-bid ceiling is **created** as well as during `runProxyAutoBids`. On violation at creation, reject with existing bid error shape; on violation after membership change during auto-bid, cancel proxy and emit `bid.proxy_cancelled` with `reason: "anti_shilling_violation"` via `DomainEventPublisher` in the same transaction as state change.
  - Replace the **hotfix** `requirePlatformAdmin` on `POST /artists/:id/review`, `POST /artists/:id/merge`, and `POST /artists/propose-matches` with `artist.review`, `artist.merge`, and `artist.read` (or `platform.admin.full` where appropriate).
- **Files touched (expected):** `packages/types/src/role-policy.ts`, `apps/api/src/middleware/require-capability.ts` (re-exports), `apps/api/src/routes/artists.ts`, `apps/api/src/routes/payouts.ts`, `apps/api/src/services/bid.service.ts`, `apps/api/src/services/domain-event.publisher.ts` (payload typing only if needed), new/updated Vitest files mirroring route and service behaviour.
- **Verification gate:** `pnpm -r typecheck` and `pnpm -r test` green; new tests prove (1) non-privileged roles cannot call gated artist/payout/legal-entity admin endpoints, (2) proxy creation blocked when buyer entity shares a member with seller entity, (3) `bid.proxy_cancelled` row appears in `domain_events` when auto-bid path cancels for anti-shilling.
- **Rollback plan:** Revert the PR; restore prior `role-policy` union and route middleware order. If any migration ships with this phase (none planned), apply paired rollback SQL. Domain events emitted after deploy are append-only — document any one-off cleanup for mistaken `bid.proxy_cancelled` rows in runbook only if needed.

### SE-P14a — Xero entity-level Contact mapping

- **Implements:** part of **DSE1** (`legal_entity.xero_contact_id` populated by resolver), part of **DSE15** (Xero **ACCPAY** bill from **`payout.paid`** at entity level).
- **Estimated:** ~1.5 weeks (original); **core shipped 2026-05-07** with consolidation/sync deferred.
- **Depends on:** **SE-P11** complete (`legal_entity_id` mandatory on reads); **SE-P0** (`xero_contact_id` column exists on `legal_entity`).
- **Scope (as shipped — core):**
  - `ensureXeroContactForLegalEntity` in `apps/api/src/services/accounting/xero-legal-entity-contact.ts`: stable `ContactNumber` (`LAXLE` + compact UUID), find-or-create via Xero API, `setXeroContactId` on `legal_entity`.
  - Buyer AR invoices: when `XERO_USE_LEGAL_ENTITY_CONTACT=true`, `XeroAccountingProvider.createCheckoutForWinner` uses buyer `legal_entity` + `findPrimaryAddressForXero`; otherwise existing email-based `ensureContact` path.
  - Paid payouts: `XeroPayoutBillWriter` + `POST /internal/jobs/xero-payout-bill` (cron secret); worker `domain_events` projector maintains an **independent `xero` cursor** and calls the internal route for each `payout.paid` event when `CRON_INTERNAL_SECRET` is set on worker + API.
  - Env: `XERO_USE_LEGAL_ENTITY_CONTACT`, `XERO_PAYOUT_BILL_ACCOUNT_CODE` (default `400`), shared token refresh in `xero-auth-runtime.ts`.
- **Scope (deferred — still valuable):**
  - One-time consolidation script (CSV duplicates; manual review before Xero archive).
  - `xero-contact-sync` job enqueue on legal-entity address/VAT mutations.
  - Xero sandbox integration test in CI.
- **Files touched:** `xero-legal-entity-contact.ts`, `xero-auth-runtime.ts`, `xero-payout-bill.writer.ts`, `xero-accounting.provider.ts`, `internal-cron.ts`, `container.ts`, `payment.service.ts`, `drizzle-legal-entity.repository.ts`, `drizzle-payout.repository.ts`, `apps/worker/src/projectors/runner.ts`, `xero-payout-bill-sync.ts`, `env.ts` (API + worker unchanged except worker projector wiring).
- **Verification gate:** `pnpm --filter @auction/api test` + typecheck green; production verification still needs Xero sandbox / OAuth tenant. Worker/API must share `CRON_INTERNAL_SECRET` for bill projection.
- **Rollback plan:** Revert PR; internal route returns 404; worker stops calling bill endpoint. `xero_contact_id` / `xero_bill_id` values already written remain valid data.

### SE-P17 — Admin legal entity lifecycle routes

- **Implements:** completes **DSE17** capability wiring; admin routes missing from SE-P13 verification.
- **Estimated:** ~1 week.
- **Depends on:** SE-P13 (`legal_entity.*` capabilities in `role-policy.ts`); **do not start until SE-P14a, SE-P14, SE-P15, and SE-P16 are complete and verified.**
- **Status (2026-05-07):** Shipped on disk (see Changelog). Route + service tests in
  `apps/api/src/routes/admin-legal-entity-lifecycle.routes.test.ts` and
  `apps/api/src/services/legal-entity-lifecycle-admin.service.test.ts`.
- **Scope:**
  - `POST /admin/legal-entities/:id/request-docs` (lead → docs_requested), `legal_entity.write`
  - `POST /admin/legal-entities/:id/start-review` (docs_received → under_review), `legal_entity.write`
  - `POST /admin/legal-entities/:id/approve` (under_review → connect_pending), `legal_entity.approve`
  - `POST /admin/legal-entities/:id/restrict` (approved → restricted), `legal_entity.write`
  - `POST /admin/legal-entities/:id/reject` (any → rejected), `legal_entity.approve`, requires reason
  - `POST /admin/legal-entities/:id/archive` (any → archived), `legal_entity.archive`, requires reason, typed-confirmation in UI (DSE18)
  - `GET /admin/legal-entities/:id` (`legal_entity.read`) for admin detail UI
  - All mutation routes write **six distinct `domain_events.event_type` values** (see Q11): `legal_entity.docs_requested`, `legal_entity.review_started`, `legal_entity.approved`, `legal_entity.restricted`, `legal_entity.rejected`, `legal_entity.archived` — each payload includes `from_status`, `to_status`, and `reason` (nullable when not required), with `actor_user_id` in the **same** DB transaction as the `legal_entity.status` update.
  - Admin web UI: `/admin/legal-entities` lookup + `/admin/legal-entities/[id]` lifecycle forms
- **Verification gate:** `pnpm test --filter @auction/api` green; route suite covers client/accountant 403, per-route capability 403 (via `roleHasCapability` spy), happy-path **concrete `event_type` per route**, reject/archive Zod 400s, service-level atomic `publish(tx, …)` and `invalid_transition` **422**.
- **Rollback plan:** revert PR; routes 404; terminal legal_entity status rows remain correct.

### SE-P14 — Invoice addressing service

- **Implements:** DSE32.
- **Estimated:** ~1 week.
- **Depends on:** **SE-P11** (`legal_entity_id` mandatory on reads); **SE-P14a** (entity-level Xero Contact + bill path in place so resolver and Xero agree on Bill-To and Contact identity).
- **Status (2026-05-07):** Shipped on disk.
- **Scope (as implemented):**
  - `BillToContext` in `packages/types/src/bill-to.ts`.
  - `InvoiceAddressingService` in `apps/api/src/services/invoice-addressing.ts` — `resolveForPayment(paymentId)` returns `{ billTo, warnings }`. Organisation: `legal_name` → `display_name`; address via `ILegalEntityRepository.findPreferredBillToLegalEntityAddress` (order **billing → both → registered_office**, then `is_default`); VAT line when `vat_number` set. Individual: `IProfileReader.getProfile(paidByUserId).name` with `displayName` fallback; `IAddressRepository.listByUser` then default row (`is_default`, else billing/both, else first).
  - **Missing-address policy (confirmed):** organisation with no `legal_entity_address` rows, or individual with no usable `user_address` → **blank lines** (`addressIncomplete: true`), **`pino.warn`** with stable event keys, and `warnings[]` for callers. No silent fallback to another user’s address.
  - `packages/email/src/templates/payment-invoice.tsx` + `payment-invoice` in `render.tsx` / `types.ts` (depends on `@auction/types`).
  - When `XERO_USE_LEGAL_ENTITY_CONTACT` is true, `XeroAccountingProvider` sets `invoice.invoiceAddresses` (TO) via `billToContextToXeroInvoiceToAddress` in `apps/api/src/services/bill-to-xero.ts` using the same resolver.
  - `invoiceAddressingService` on `Container` for API routes / jobs to reuse.
- **Deviation:** No production code path yet enqueues `payment-invoice` (template is ready; wire when invoice notification job exists). `invoice-issued` unchanged.
- **Verification gate:** `invoice-addressing.test.ts` (7 cases); `packages/email/src/render.test.ts` payment-invoice case; full `pnpm typecheck` / `pnpm test` green.
- **Rollback plan:** Revert PR; Xero bill-to extras omitted when flag off; no DB migration.

### SE-P15 — Payout statements + domain-event PII policy formalisation

- **Implements:** DSE33, DSE31.
- **Estimated:** ~2 weeks.
- **Depends on:** SE-P8 / SE-P8.5 / payout settlement paths stable (settlement + `markPaid` + Stripe transfer reconciliation exist); SE-P13 complete so `audit.read_pii` exists before audit export exposes raw payloads.
- **Scope:**
  - Migration `0030_payout_statement_url.sql`: add nullable `payout.statement_url text` (or equivalent) for cached Spaces URL.
  - Worker job `apps/worker/src/jobs/generate-payout-statement.ts` (BullMQ): lazy PDF generation using a lightweight library (**pdfkit** or **PDFKit**-style; pick one and pin version in worker `package.json`).
  - Routes: `GET` entity-scoped statement download and `GET` admin variant (exact paths as in DSE33 — implement behind auth + capability checks).
  - Spaces prefix `payout-statements/{legal_entity_id}/{payout_id}.pdf`; document 7-year retention in ops runbook.
  - **DSE31:** Implement `redactDomainEventPayload` under `apps/worker/src/projectors/lib/`; add `docs/architecture/04-domain-events.md` documenting default-minimal-PII + enumerated exceptions; route audit CSV/API exports through redaction unless caller has `audit.read_pii`.
- **Files touched (expected):** `packages/db/drizzle/0030_*.sql`, Drizzle schema `payouts.ts`, worker job + queue registration, API routes + web download links, `docs/architecture/04-domain-events.md`, projector lib tests.
- **Verification gate:** Migration apply/rollback tested in CI; Vitest for redaction helper (PII stripped vs allowed keys); integration test that first PDF request enqueues job and second hits cache; `pnpm -r typecheck` / `pnpm -r test` green.
- **Rollback plan:** Deploy API flag to disable new routes if needed; run `0030_rollback.sql` to drop `statement_url` after draining in-flight jobs; objects in Spaces can remain (cost) or be lifecycle-deleted per runbook — not blocking rollback of code.

### SE-P16 — Admin impersonation safety

- **Implements:** DSE34.
- **Estimated:** ~1.5 weeks.
- **Depends on:** SE-P13 (`audit.read_pii` and finer capabilities exist); acting-context cookie + middleware behaviour understood (`require-legal-entity-context.ts`, web cookie helpers).
- **Scope:**
  - When `user.role === "administrator"` selects an acting entity they are **not** a member of, treat as impersonation: store start timestamp in cookie; reject requests if older than **4 hours**; emit `admin.impersonation_started` / `admin.impersonation_ended` domain events on switch and expiry.
  - Web: `apps/web/src/components/admin/impersonation-banner.tsx` — fixed top, non-dismissable, countdown + “End now”.
  - Email: `packages/email/src/templates/admin-impersonation-notice.tsx` to owners/admins (and primary admin); worker projector `apps/worker/src/projectors/admin-impersonation-notify.ts` fans out send job.
  - Admin chrome: append “(impersonated)” to document title / breadcrumb context.
  - DB: partial index on `domain_events` for `is_admin_impersonation` predicate (as in DSE34), implemented via new migration if not expressible in Drizzle-only drift.
- **Files touched (expected):** middleware, cookie helpers, web admin layout, email template + worker projector, `domain_events` migration, Vitest for middleware timing + event emission.
- **Verification gate:** Tests cover: impersonation cookie expires at 4h boundary; events emitted start/end; banner renders only in impersonation mode; email dispatcher invoked once per start (mock).
- **Rollback plan:** Feature flag off impersonation enforcement (revert to current administrator bypass without timeout); drop new index via migration rollback if shipped.

### SE-P18a — Money correctness (launch-blocking)

- **Implements:** Critical money-flow gaps identified in logical audit of SE-P13–SE-P17.
- **Estimated:** 1.5–2 weeks.
- **Depends on:** SE-P17 complete; existing codebase uncommitted until SE-P18a lands.
- **Status:** Proposed — awaiting authorization.

#### Scope

1. **Stripe Connect transfers in settlement worker**
   - After `payout` row + lines are committed, call `stripe.transfers.create` with `destination = legal_entity.stripe_connect_account_id`, `amount = net_amount`, `currency`, `metadata`.
   - Persist the returned `transfer_id` on the payout row.
   - Handle Stripe API errors with retry + exponential backoff; if final retry fails, mark `payout.status = 'failed'` with `failure_reason`.
   - Emit `payout.transfer_initiated` domain event.
   - **Files:** `apps/api/src/services/payout.service.ts`, `apps/worker/src/jobs/bulk-payout-settlement.ts`, payout schema (if `transfer_id` column missing).

2. **Stripe webhook handlers for disputes/refunds/reversals**
   - Implement handlers for: `charge.dispute.created`, `charge.dispute.funds_withdrawn`, `charge.dispute.closed` (won/lost), `charge.refunded`, `transfer.reversed`.
   - Each handler updates `payment.status` appropriately AND inserts a negative `payout_line` on the next-running payout (or reopens current payout if not yet processed).
   - Emit domain events: `payment.refunded`, `payment.dispute_opened`, `payment.dispute_closed`.
   - Send notifications to seller + admin.
   - **Files:** `apps/api/src/routes/webhooks/stripe.ts`, `apps/api/src/services/payment.service.ts`, `apps/api/src/services/payout.service.ts`, new projector for negative-line insertion, notification templates.

3. **Status enforcement on payment paths**
   - Payment capture: gate on `legal_entity.status IN ('approved', 'restricted', 'connect_pending')` — payment can capture even pre-approval if buyer is willing.
   - Payment refund (admin): verify seller entity is not archived before processing.
   - **Files:** `apps/api/src/services/payment.service.ts`, plan file DSE12 update (payment section).

4. **Domain event emission for manual refund path**
   - Add `payment.refunded` event emission in `refundPayment` admin path.
   - **Files:** `apps/api/src/services/payment.service.ts`.

#### Verification gates

| Fix area | Verification |
|----------|-------------|
| Stripe transfer initiation | Integration test against Stripe sandbox; mock test for retry/backoff |
| Webhook handlers | Test fixture replay of dispute/refund events from Stripe sample payloads |
| Status enforcement (payment) | Route tests proving archived/rejected entities cannot capture/refund |
| Refund event emission | Service test asserting `payment.refunded` event is published |

#### Scenario re-verification (required before SE-P18a close)

Before declaring SE-P18a complete, re-run and document answers for:

1. **Scenario 1 (organisation onboarding to first sale):** Does Stripe transfer fire automatically? Where exactly in the code path?
2. **Scenario 2 (archived entity still bidding):** Does `findActiveMembership` now reject archived/rejected? (Note: full bid/submission gating is SE-P18b; payment-path gating must work here.)
3. **Scenario 4 (refund of settled payment):** Does the chargeback webhook fire? Does negative `payout_line` get inserted? Is the seller notified?
4. **Scenario 9 (admin lifecycle race):** Does the second admin's call now fail/conflict with the first? (Note: row lock is SE-P18b; verify existing behaviour and confirm SE-P18b scope.)

Paste scenario answers as part of SE-P18a completion report.

- **Rollback plan:** Stripe webhook handlers can be disabled via env flag (`STRIPE_WEBHOOKS_ENABLED=false`). Transfer initiation can be skipped via `STRIPE_TRANSFERS_ENABLED=false`. Per-fix granular rollbacks documented in implementation.

---

### SE-P18b — State integrity (significant but recoverable)

- **Implements:** State-integrity gaps identified in logical audit; recoverable if missed at launch but should ship before v1.1.
- **Estimated:** 1–1.5 weeks.
- **Depends on:** SE-P18a complete and committed.
- **Status:** Blocked on SE-P18a.

#### Scope

1. **Status enforcement on submission/bid/membership paths**
   - `findActiveMembership` in repositories: filter by `legal_entity.status NOT IN ('rejected', 'archived')`, OR add a separate check before any mutation.
   - Submission service: gate on `status = 'approved'` or `status = 'restricted'` (with admin co-sign for restricted).
   - Bid service: gate on `status IN ('approved', 'restricted')`.
   - Document the precise gating matrix in DSE12.
   - **Files:** `apps/api/src/repositories/drizzle-legal-entity.repository.ts`, `apps/api/src/services/item-submission.service.ts`, `apps/api/src/services/bid.service.ts`, plan file DSE12 update.

2. **Archive cascade logic**
   - When `legal_entity.status` transitions to `'archived'`, enqueue a worker job that:
     - Cancels open proxies for that entity
     - Removes lots from active sales (or at minimum flags them)
     - Notifies all members
   - **Files:** `apps/api/src/services/legal-entity-lifecycle-admin.service.ts`, new worker job, notification template.

3. **Anti-shilling re-validation at `finalizeLotEnding`**
   - At lot close time, if winning bid violates anti-shilling with current membership state, fall back to next valid bid OR mark lot as void and notify admin.
   - **Files:** `apps/api/src/services/lot-lifecycle.service.ts`, `apps/api/src/repositories/drizzle-anti-shilling.repository.ts`.

4. **Proxy cleanup at `removeMember`**
   - Cancel any active proxies placed by the removed user for the entity they were removed from.
   - Emit `bid.proxy_cancelled` with `reason = 'member_removed'`.
   - **Files:** `apps/api/src/services/member-management.service.ts`, `apps/api/src/services/bid.service.ts`.

5. **Row locks for race conditions**
   - Add `SELECT FOR UPDATE` in artist merge transaction (`apps/api/src/services/artist-registry.service.ts` merge function).
   - Add `SELECT FOR UPDATE` in `legal_entity_lifecycle_admin.runTransition`; OR add `WHERE status = $current_status` on the UPDATE and check `rowsAffected` to detect concurrent modification.
   - **Files:** `apps/api/src/services/artist-registry.service.ts`, `apps/api/src/services/legal-entity-lifecycle-admin.service.ts`.

6. **`member_removed` event emission**
   - Add domain event emission in `removeMember` service.
   - **Files:** `apps/api/src/services/member-management.service.ts`.

7. **Background sweeper for expired impersonations**
   - Every 6 hours, find `admin.impersonation_started` events without matching `ended` events older than 4h + grace.
   - Emit `admin.impersonation_ended` with `end_reason = 'timeout_swept'`.
   - **Files:** new worker job or cron handler, projector query.

#### Verification gates

| Fix area | Verification |
|----------|-------------|
| Status enforcement (bid/submission) | Route tests proving each status blocks/allows the right actions |
| Archive cascade | Service test mocking worker enqueue; integration test for proxy cancellation |
| Anti-shilling at close | Lot lifecycle test with fixture violating proxy |
| Proxy cleanup | Member removal test asserting proxies cancelled + event emitted |
| Race conditions | Tests using Postgres real txns to verify serialization |
| Impersonation sweeper | Test that sweeper emits event for stale session |

- **Rollback plan:** Status enforcement can be relaxed (allow all statuses) via config flag if emergency rollback required. Archive cascade job can be disabled. Other fixes are additive and safe to revert.

---

### SE-P18c — Operational polish

- **Implements:** Operational hygiene items from audit; non-blocking but should ship before production traffic.
- **Estimated:** 2–3 days.
- **Depends on:** SE-P18b complete and committed.
- **Status:** Blocked on SE-P18b.

#### Scope

1. **Settlement cron alignment (weekly Mondays 09:00 UTC)**
   - Current code: `repeat: { every: 86_400_000 }` (daily 24h interval).
   - Update to BullMQ cron pattern for weekly Mondays 09:00 UTC: `repeat: { cron: '0 9 * * 1', tz: 'UTC' }`.
   - Traditional UK auction house cadence: weekly settlement reduces Stripe fees, simplifies admin reconciliation.
   - **Files:** `apps/worker/src/index.ts`.

2. **Seller dashboard entity status banner**
   - When acting entity is `'archived'` or `'rejected'`, render a warning banner in the dashboard.
   - **Files:** `apps/web/src/components/layout/acting-as-banner.tsx` or `legal-entity-switcher.tsx`, dashboard layout.

3. **`0031_rollback.sql`**
   - Add rollback script for the partial index migration (drop the index).
   - **Files:** `packages/db/drizzle/0031_rollback.sql`.

4. **SE-P15 rollback runbook**
   - Document rollback procedure for payout statement feature.
   - **Files:** `docs/runbooks/se-p15-rollback.md`.

#### Verification gates

| Fix area | Verification |
|----------|-------------|
| Settlement cron | Manual verification in staging; unit test for cron pattern parsing |
| Entity status banner | Visual test / snapshot; E2E if available |
| Rollback scripts | Migration apply/rollback tested in CI |

- **Rollback plan:** Each item is independent and trivially revertible.

---

**Edge cases (deferred beyond SE-P18):**

- Hard-coded 5% buyer premium → use `legal_entity.platform_fee_bps` when set (low priority).
- Currency column on `payment` table for forward-compat (schema change, not urgent).
- Admin UI rendering of `stripe_connect_requirements_currently_due` (UX polish).
- Cookie `maxAge` alignment with server impersonation timeout (minor consistency).

---

## Deferred work and follow-ups

Items that accumulated across SE-P13 through SE-P17 and were explicitly deferred. Consolidate here for discoverability; scheduling into future phases is a separate decision.

### Pre-launch (must close before going live)

| Item | Source | Why deferred | Effort |
|------|--------|--------------|--------|
| **Xero Contact consolidation script** — One-time CSV script to reconcile historical Xero Contacts created before `XERO_USE_LEGAL_ENTITY_CONTACT` was enabled. Identifies duplicates (same email or business name across legacy user-based Contacts vs new legal-entity Contacts), outputs merge candidates for manual review, and optionally archives orphaned Contacts so flipping the feature flag doesn't orphan AR history. | SE-P14a deferred scope | Core Contact resolution + Bill projection shipped first; consolidation is data-cleanup rather than feature logic. | ~0.5 day script + manual review time |
| **Xero sandbox CI** — GitHub Actions job that runs Xero integration tests against the Xero demo company (sandbox). Validates token refresh, Contact create/lookup, and Bill creation without touching production. | SE-P14a deferred scope | Shipping core integration was higher priority; sandbox CI is infrastructure hygiene. | ~0.5 day |
| **Anti-shilling check at proxy creation time (DSE36 partial)** — The auto-bid path guard is implemented (cancels violating proxies when membership changes). The creation-time rejection (prevent proxy setup if buyer-entity already shares a member with seller-entity) needs verification or completion so both defense-in-depth checks are present. | DSE36 / SE-P13 | Auto-bid path covered the immediate risk; creation-time check is belt-and-suspenders. | ~0.25 day (verify or add) |

### Soon after launch (v1.1)

| Item | Source | Why deferred | Effort |
|------|--------|--------------|--------|
| **`bid.proxy_cancelled` bidder notification** — When a proxy is auto-cancelled for anti-shilling violation, notify the affected bidder (push + email). The `bid.proxy_cancelled` domain event already fires; notification wiring is missing. | DSE36 / SE-P13 follow-up | Event emission was the priority; notification is UX polish. | ~0.5 day (template + projector) |
| **`legal_entity.created` hook for personal entities** — Organisation onboarding emits `legal_entity.created`; personal entities created/backfilled by default acting context do not yet emit a creation event. Add a v1.1 hook once the personal-entity lifecycle is no longer migration/backfill-only. | Q11 / SE-P19 accepted deferral | Avoids layering event shims around backfilled/personal rows before their lifecycle is finalized. | ~0.25 day |
| **`propose-matches` audit-write failure handling** — Verify that a failure in the short post-search audit transaction for `artist.propose_matches` does not surface as a user-visible 500. If it does, wrap in try/catch and log-only so the UI still returns search results. | SE-P13 minor follow-ups | Core artist matching logic was the priority; edge-case audit failure is low-frequency. | ~0.25 day (verify + fix if needed) |
| **`xero-contact-sync` queue for address/VAT updates** — Enqueue a Contact update job when a legal entity's address or VAT number changes (mutation paths in member-management or org-onboarding). Currently the Contact is created on first invoice; subsequent edits don't propagate. | SE-P14a deferred scope | Initial Contact creation covered the common path; delta-sync is incremental improvement. | ~0.5 day |

### Performance / hygiene (low priority)

| Item | Source | Why deferred | Effort |
|------|--------|--------------|--------|
| **Duplicate auth calls in admin layout** — `generateMetadata` and the admin `layout.tsx` each independently call `requireAuthenticatedUser` + `resolveActingContext`, resulting in two DB lookups per admin page render. Consolidate to a single fetch (e.g., React cache or shared server-context helper). | SE-P16 minor follow-ups | Functionality correct; performance impact is minor (admin-only, low traffic). | ~0.25 day |

---

## Migration / cutover status

- Write paths in `lot`, `sale`, `bid`, `payment`, and `item_submission` now
  require legal-entity ids at the repository/service boundary. The old
  repository-side dual-write fallback resolution has been removed.
- Read paths return legal-entity ownership ids via the mapper layer; mapper
  fallbacks to legacy user ids have been removed.
- Deprecated ownership columns are dropped by
  `0028_legal_entity_final_cutover.sql`. Human user ids remain where they are
  still live audit/payment-user data rather than ownership data.
- Personal-`legal_entity` rows are created eagerly by 0027 for every user.

## Recommended next step

0. **Security hotfix (ship before SE-P13):** `POST /artists/:id/review`,
   `POST /artists/:id/merge`, and `POST /artists/propose-matches` are gated
   with `requirePlatformAdmin` (`platform.admin.full`). Run the read-only
   SQL in `docs/runbooks/artist-review-security-audit.md` to flag historical
   approvals/merges not attributed to an `administrator` user. SE-P13 will
   replace these temporary gates with finer `artist.review`, `artist.merge`,
   and `artist.read` (or equivalent) capabilities.

1. **Optional: SE-P2 — surface `hasSeenActingContextTooltip` in the
   session contract.** Today the dashboard layout passes the tooltip
   default-off; add `hasSeenActingContextTooltip` to `SessionUser` (it
   already exists on the `user` row + repo) so the tooltip can be shown
   to brand-new organisation members exactly once.
2. **Domain-events pass** — once services start using
   `DomainEventPublisher`, add `payout.paid` and related entity-aware
   payloads alongside the rest of the outbox work.
3. **Payout cron / bulk settlement** — replace the one-entity manual
   settlement form with a scheduled job that fans out over eligible seller
   legal entities and emits reconciliation telemetry.

## Open questions still pending

- Q0: selling-entity verification lifecycle (states, transitions, per-state
  effects, per-kind differences).
- Q1–Q4: roles matrix, acting-context storage, buyer-side scope,
  anti-shilling rule.
- Q5–Q9: payouts scope, artist ownership, user-scoped table fates,
  migration / backfill strategy, KYC / entity-verification relationship.
- Q10–Q13: API authorization mechanism, domain-events payload changes,
  user.role interaction, out-of-scope items.

## Changelog

- **2026-05-07 (SE-P21 — Round 3 launch production correctness)** — Batch
  anti-shilling at auction close via `findEligibleBidsForLotClose`; lot void
  reason `no_valid_winner` (+ projector accepts legacy `anti_shilling_at_close`);
  Redis NX lock on `POST /internal/jobs/bulk-payout-settlement`; runbooks
  `domain-events-retention.md` and `scale-monitoring.md`. Tests: lifecycle unit,
  settlement lock unit, optional Postgres integration for eligible-bids SQL.
  `pnpm typecheck` + `pnpm test` green.

- **2026-05-07 (SE-P20 — Round 2 security hardening)** — See “Round 2 security audit
  summary” in §3 for the full list. Follow-up: `createSubmissionsLegalEntityContext`
  (personal entity when `X-Legal-Entity-Id` missing) + web `resolveActingContext`
  seeds `lax_acting_legal_entity_id` on first authenticated load. Better Auth
  session cookie defaults documented in `packages/auth/src/server.ts` (verified
  from `better-auth` `createCookie`). Plan table + §3 summary updated.

- **2026-05-07 (SE-P19 — Completeness backfill)** — Typed destructive confirmations,
  clear-artist-blocks worker projector, three-pass lot artist backfill scripts + admin
  review queue, extended finance/onboarding admin metrics and `/admin/onboarding-issues`,
  KYC→entity auto-progress after Identity verification + Connect-ready lifecycle domain
  event, member/org domain events (`legal_entity.created`, member invited/accepted/role
  changed, `kyc.verified`). Documented payout domain-event naming variance in §1 Q11.
  Verification: `pnpm typecheck`, `pnpm test` at repo root.

- **2026-05-07 (SE-P18a — Money correctness)** — Implemented launch-blocking
  money-flow fixes: **(1)** Stripe Connect transfers in settlement worker —
  `stripe.transfers.create` called after payout creation, retry with exponential
  backoff, `payout.transfer_initiated` / `payout.transfer_failed` domain events,
  `payout-transfer-failed-notice` email template, worker projector for finance
  notifications. **(2)** Stripe webhook handlers for disputes/refunds —
  `POST /webhooks/stripe/payments` endpoint, `charge.dispute.created`,
  `charge.dispute.closed` (won/lost outcome handling), `charge.refunded` handlers
  with webhook dedupe (`event_key = "stripe:" + event.id`) and payout_line
  idempotency (`source_event_id` column + unique constraint). **(3)** Status
  enforcement on payment paths — `refundPayment` now rejects if seller entity is
  archived/rejected. **(4)** Domain event emission for manual refund —
  `payment.refunded` event with `via='admin_manual'`. Migration 0032 adds
  `payout_line.source_event_id` and unique index. Typecheck and all 258 API tests
  green. Scenario re-verification documented in completion report. Note: webhook
  handlers require Stripe sandbox integration tests (credentials needed).

- **2026-05-07 (deferred work consolidation)** — Consolidated all deferred items,
  follow-ups, and v1.1 work from SE-P13 through SE-P17 into a single "Deferred
  work and follow-ups" section at the end of §3. Three categories: **Pre-launch**
  (Xero Contact consolidation script, Xero sandbox CI, proxy creation anti-shilling
  verification), **Soon after launch (v1.1)** (`bid.proxy_cancelled` notification,
  `propose-matches` audit-write handling, `xero-contact-sync` queue), **Performance /
  hygiene** (admin layout duplicate auth calls). Each item includes source phase,
  deferral rationale, and effort estimate. Phase status table updated to mark all
  SE-P0 through SE-P17 as complete.

- **2026-05-07 (SE-P17 restructure)** — Split the interim single
  `legal_entity.admin_status_transition` event into **six** distinct `event_type`
  values per original §1 Q11: `legal_entity.docs_requested`, `legal_entity.review_started`
  (maps admin `start_review` op), `legal_entity.approved`, `legal_entity.restricted`,
  `legal_entity.rejected`, `legal_entity.archived`. Payloads: `from_status`, `to_status`,
  `reason` only (dropped `transition`). Plan Q11 / DSE9 / DSE28 and `domain-event-pii`
  allowlists reverted to per–`event_type` routing. Route + service tests assert the
  concrete type per POST. `pnpm test --filter @auction/api` green (**252** tests);
  `pnpm test --filter @auction/types` green (**13** tests, six PII rows for lifecycle).

- **2026-05-07 (SE-P17 — DSE17)** — Admin lifecycle under `POST /admin/legal-entities/:id/*`
  (`request-docs`, `start-review`, `approve`, `restrict`, `reject`, `archive`) plus
  `GET /admin/legal-entities/:id`. Capability gates: `legal_entity.write` |
  `legal_entity.approve` | `legal_entity.archive` per route. *(Superseded for event
  typing by the same-day “SE-P17 restructure” entry above — six distinct event types,
  not `admin_status_transition`.)* Status update and event insert share one DB
  transaction. Web: lookup + detail pages, DSE18 archive confirmation in server action.
  **Tests:** `apps/api/src/routes/admin-legal-entity-lifecycle.routes.test.ts`,
  `apps/api/src/services/legal-entity-lifecycle-admin.service.test.ts`.
  `pnpm test --filter @auction/api` green.

- **2026-05-07 (SE-P14 — DSE32)** — Added `BillToContext` (`packages/types/src/bill-to.ts`),
  `InvoiceAddressingService` + Vitest matrix (org with/without VAT, missing org
  address, individual with/without default address, display_name fallback,
  non-default address pick). `ILegalEntityRepository.findPreferredBillToLegalEntityAddress`
  (billing → both → registered_office). New email template `payment-invoice`
  (`@auction/types` in `@auction/email`). When `XERO_USE_LEGAL_ENTITY_CONTACT`,
  `XeroAccountingProvider` applies the same resolver to Xero `invoiceAddresses`
  (TO). Missing org / individual address: blank bill-to + `pino` ops warnings
  (option **a**, confirmed). `Container.invoiceAddressingService` exposed for
  future send paths.

- **2026-05-07 (SE-P13 — DSE35, DSE36)** — Extended `role-policy.ts` with
  `legal_entity.*`, `artist.read|review|merge`, `payout.read|process|reverse`,
  and `audit.read_pii` (administrator / accountant mappings per plan).
  Artist admin routes now use `requireArtistRead` / `requireArtistReview` /
  `requireArtistMerge`; admin payout list/mutations use `payout.read` /
  `payout.process`. `ArtistRegistryService` writes `artist.reviewed`,
  `artist.merged`, and `artist.propose_matches` domain events in the same
  transaction as catalogue mutations (propose-matches audit in a short
  post-search transaction). `BidService` uses `violatesAntiShilling` (bidder
  in seller org **or** buyer/seller legal-entity member overlap / same
  entity), clears violating proxy ceilings, emits `bid.proxy_cancelled` with
  `reason: anti_shilling_violation` via `DomainEventPublisher` in the bid
  transaction, and records correct `buyerLegalEntityId` on auto-generated
  proxy bids. `IRepositoryFactory.runInTransaction` passes the Drizzle `tx`
  for event inserts. Tests: `role-policy.test.ts`, `artists.security.test.ts`,
  `bid.service.test.ts` (proxy cancel + shilling), `lot-lifecycle.service.test.ts`.
  Full monorepo `pnpm lint`, `pnpm typecheck`, `pnpm test` green.

- **2026-05-07 (artist admin hotfix)** — `POST /artists/:id/review`,
  `POST /artists/:id/merge`, and `POST /artists/propose-matches` now require
  `requirePlatformAdmin` so only platform administrators can approve, merge,
  or run the admin propose-matches bucket UI. Added
  `apps/api/src/routes/artists.security.test.ts` and
  `docs/runbooks/artist-review-security-audit.md` (SQL to flag historical
  non-admin `reviewed_by_user_id` rows). SE-P13 will replace these temporary
  `requirePlatformAdmin` gates with finer `artist.review` / `artist.merge` /
  `artist.read` (or equivalent) capabilities.

- **2026-05-06 (SE-P12 final cutover)** — deprecated ownership columns were
  removed from the Drizzle model and covered by
  `0028_legal_entity_final_cutover.sql`; legal-entity ownership columns are
  now non-null. Repository dual-write fallback resolution was removed for
  lots, sales, bids, payments, and item submissions. Bid placement, sale
  nested lot creation, item-submission ownership, KYC exposure, seed data,
  and web view models now use legal-entity ids at the relevant boundaries.
  Full monorepo typecheck and test suite pass (**301 tests**). SE-P12 touched
  files lint clean; repository-wide lint still has unrelated pre-existing
  formatting/import findings.
- **2026-05-06 (SE-P11 read flip)** — mapper read paths now require
  backfilled legal-entity columns for lots, bids, item submissions, sales,
  and payments. The old `?? legacy_user_id` mapper fallbacks were removed;
  missing backfill data now raises `missing_backfilled_legal_entity_id:*`
  before SE-P12 drops legacy columns. Added mapper coverage for strict
  reads and missing-backfill failures. Full monorepo typecheck and test
  suite pass (**301 tests**); API lint clean.
- **2026-05-06 (SE-P10 notification routing)** — legal-entity notification
  recipient routing landed with seller / finance / admin audience role
  matrices. Lot cancellation, submission approval/rejection, and payment
  capture notifications now fan out to accepted active legal-entity members
  with legacy user fallback during the dual-write window. Added the Drizzle
  recipient reader, routing helper, container wiring, and focused coverage.
  Full monorepo typecheck and test suite pass (**299 tests**); API lint
  clean.
- **2026-05-06 (SE-P9 anti-shilling)** — bid placement now blocks users
  who are active members of the lot seller's legal entity, in addition to
  the legacy `sellerId === bidderId` strategy check. Proxy auto-bid
  resolution skips seller-entity candidates as well, so existing max
  ceilings cannot generate seller-side bids after membership changes.
  Added `DrizzleAntiShillingRepository`, injected it into `BidService`,
  and expanded bid-service coverage to 12 cases. Full monorepo typecheck
  and test suite pass (**294 tests**); API lint clean.
- **2026-05-06 (admin payouts UI)** — `/admin/payouts` landed in the
  finance route group. It lists payouts from the admin API, supports
  status / legal-entity filtering, shows visible payout KPIs, and exposes
  server-action forms for one-entity settlement runs, manual adjustments,
  and mark-paid transitions. Added `getAdminPayoutList`, admin payout
  server actions, and admin/accountant nav entries. Full monorepo
  typecheck and test suite still pass (**291 tests**); web lint clean.
- **2026-05-06 (latest)** — SE-P8.5 landed: Stripe Connect
  `transfer.*` webhook reconciliation now delegates into
  `PayoutService.reconcileStripeTransfer`, using `metadata.payoutId` when
  present and transfer-id lookup otherwise. The payout repository persists
  transfer id, status, optional Stripe fee, `processedAt`, and failure
  reason, and recomputes net amount when Stripe fee is supplied. Added 5
  tests (3 payout-service, 2 Connect webhook); monorepo now has **291
  tests passing** with full typecheck and API lint clean.
- **2026-05-06 (later)** — SE-P8 landed: payout service / repo / routes,
  seller `/dashboard/seller/payouts` wired to live API, container DI
  updated, app routing added under `/payouts` and `/admin/payouts`.
  Vitest coverage added for SE-P2 / P3 / P5 / P7 / P8 (45 new cases).
  `AppShell` got an opt-in `headerSlot` so the dashboard layout can pass
  the server-rendered `<ActingAsBanner />` without making the whole
  shell a server component. New `/dashboard/team` route lists members,
  invites, role changes, primary-admin transfer (with its own
  switching-entity empty state). Selling-workspace nav now exposes a
  Team link. Total monorepo: **286 tests passing**, full typecheck +
  lint clean across API and web.
- **2026-05-06** — Re-implemented SE-P2 → SE-P7 with typecheck gates between
  every phase. All 13 packages typecheck clean; all 35 new files lint
  clean. Stripe SDK v22 installed in `@auction/api`.
- **2026-05-06 (earlier)** — Audit reconciled. Re-added missing
  `DrizzleUserRepository.updateActingContextTooltipSeen` and tightened
  `CreateSaleInput.createdBy` back to required so monorepo typechecks
  again.
