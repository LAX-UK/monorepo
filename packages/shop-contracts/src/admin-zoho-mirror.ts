import { type Static, Type } from "@sinclair/typebox";

/** The records LAX Admin can ask about: a Shop order, or an artwork in the register. */
export const ZOHO_MIRROR_ENTITIES = ["order", "artwork"] as const;
export type ZohoMirrorEntity = (typeof ZOHO_MIRROR_ENTITIES)[number];

/** How many records one batched read answers for. */
export const ZOHO_MIRROR_BATCH_LIMIT = 100;

/**
 * The one state a record has, worked out from the delivery ledger and never stored.
 * `not_applicable` has no badge in the header; the details say why.
 */
export const ZOHO_MIRROR_STATES = [
  "mirrored",
  "pending",
  "failed",
  "not_applicable",
  "dry_run",
] as const;
export type ZohoMirrorState = (typeof ZOHO_MIRROR_STATES)[number];

/** Why a record is not mirrored, when `state` is `not_applicable`; null otherwise. */
export const ZOHO_MIRROR_NOT_APPLICABLE_REASONS = [
  "mirroring_off",
  "not_paid",
  "nothing_to_mirror",
  "not_sent_yet",
] as const;
export type ZohoMirrorNotApplicableReason = (typeof ZOHO_MIRROR_NOT_APPLICABLE_REASONS)[number];

const DateTime = Type.String({ format: "date-time" });
const NullableDateTime = Type.Union([DateTime, Type.Null()]);
const NullableString = Type.Union([Type.String(), Type.Null()]);

const Entity = Type.Union(ZOHO_MIRROR_ENTITIES.map((entity) => Type.Literal(entity)));
const IdPattern = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

export const AdminZohoMirrorStatusQuerySchema = Type.Object({
  entity: Entity,
  id: Type.String({ pattern: IdPattern }),
});

/** The batched form, for a list column: `ids` is a comma-separated list. */
export const AdminZohoMirrorStatusesQuerySchema = Type.Object({
  entity: Entity,
  ids: Type.String({ minLength: 1, maxLength: ZOHO_MIRROR_BATCH_LIMIT * 37 }),
});

export const AdminZohoMirrorStatusSchema = Type.Object({
  entity: Entity,
  id: Type.String(),
  state: Type.Union(ZOHO_MIRROR_STATES.map((state) => Type.Literal(state))),
  /** The delivery consumer the state was read from. */
  consumer: Type.String(),
  /** Set only when `state` is `not_applicable`. */
  notApplicableReason: Type.Union([
    Type.Union(ZOHO_MIRROR_NOT_APPLICABLE_REASONS.map((reason) => Type.Literal(reason))),
    Type.Null(),
  ]),
  /** How the mirror last ran for this record, as the ledger shows it; null when it shows nothing. */
  mode: Type.Union([
    Type.Literal("off"),
    Type.Literal("dry_run"),
    Type.Literal("live"),
    Type.Null(),
  ]),
  lastAttemptAt: NullableDateTime,
  nextRetryAt: NullableDateTime,
  attempts: Type.Integer({ minimum: 0 }),
  /** The Zoho record the last successful send reached, when it named one. */
  providerReference: NullableString,
  /** The redacted reason of the last failed attempt; set only when `state` is `failed`. */
  error: NullableString,
});

export const AdminZohoMirrorStatusListSchema = Type.Object({
  items: Type.Array(AdminZohoMirrorStatusSchema),
});

export type AdminZohoMirrorStatusQuery = Static<typeof AdminZohoMirrorStatusQuerySchema>;
export type AdminZohoMirrorStatusesQuery = Static<typeof AdminZohoMirrorStatusesQuerySchema>;
export type AdminZohoMirrorStatus = Static<typeof AdminZohoMirrorStatusSchema>;
export type AdminZohoMirrorStatusList = Static<typeof AdminZohoMirrorStatusListSchema>;
