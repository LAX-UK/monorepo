import { type Static, Type } from "@sinclair/typebox";

/**
 * Consignor agreements in LAX Admin (register item ZI-5, docs/design/decision-pack-2026-11-17.md
 * section 1, option B). A consignor is a client (`clients/[partyId]`); an agreement records the
 * places LAX may offer their works, from and until when, an optional lowest price and commission,
 * the signed file and a note. It is replaced by a new version, never edited in place, and retired
 * rather than deleted. Each original in the register names its consignor: a client, or "LAX owns
 * this work".
 *
 * No route serves these yet. The terms are checked again by `parseAgreementTerms` in
 * `artwork-register-contracts`; the limits here only stop an oversized or malformed body.
 * Amounts are whole minor units: pence, and basis points for the commission (2500 is 25 %).
 */

export const ConsignmentPlaceSchema = Type.Union([
  Type.Literal("lax_bid"),
  Type.Literal("lax_art"),
  Type.Literal("private_sale"),
]);
export type ConsignmentPlaceContract = Static<typeof ConsignmentPlaceSchema>;

const Day = Type.String({ format: "date" });
const NullableDay = Type.Union([Day, Type.Null()]);
const Pence = Type.Integer({ minimum: 1, maximum: 999_999_999 });
const BasisPoints = Type.Integer({ minimum: 0, maximum: 10_000 });

export const AdminConsignorAgreementSchema = Type.Object(
  {
    /** This version. */
    id: Type.String({ format: "uuid" }),
    /** The agreement across its versions (the first version's id). */
    agreementId: Type.String({ format: "uuid" }),
    version: Type.Integer({ minimum: 1 }),
    partyId: Type.String({ format: "uuid" }),
    places: Type.Array(ConsignmentPlaceSchema, { minItems: 1, maxItems: 3, uniqueItems: true }),
    startsOn: Day,
    /** Null: until retired. */
    endsOn: NullableDay,
    lowestPricePence: Type.Union([Pence, Type.Null()]),
    commissionBasisPoints: Type.Union([BasisPoints, Type.Null()]),
    signedFileKey: Type.String({ minLength: 1, maxLength: 512 }),
    note: Type.Union([Type.String(), Type.Null()]),
    status: Type.Union([
      Type.Literal("current"),
      Type.Literal("replaced"),
      Type.Literal("retired"),
    ]),
    replacesId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    replacedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    retiredAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type AdminConsignorAgreement = Static<typeof AdminConsignorAgreementSchema>;

export const AdminConsignorAgreementListSchema = Type.Object(
  {
    /** Current versions first, then retired and replaced ones, newest first. */
    items: Type.Array(AdminConsignorAgreementSchema),
  },
  { additionalProperties: false },
);
export type AdminConsignorAgreementList = Static<typeof AdminConsignorAgreementListSchema>;

export const AdminConsignorAgreementParamsSchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
  agreementId: Type.String({ format: "uuid" }),
});
export type AdminConsignorAgreementParams = Static<typeof AdminConsignorAgreementParamsSchema>;

const TermsFields = {
  places: Type.Array(ConsignmentPlaceSchema, { minItems: 1, maxItems: 3, uniqueItems: true }),
  startsOn: Day,
  endsOn: Type.Optional(NullableDay),
  lowestPricePence: Type.Optional(Type.Union([Pence, Type.Null()])),
  commissionBasisPoints: Type.Optional(Type.Union([BasisPoints, Type.Null()])),
  signedFileKey: Type.String({ minLength: 1, maxLength: 512 }),
  note: Type.Optional(Type.Union([Type.String({ maxLength: 4000 }), Type.Null()])),
};

/** "Add agreement" on a client's page. */
export const AdminConsignorAgreementCreateBodySchema = Type.Object(TermsFields, {
  additionalProperties: false,
});
export type AdminConsignorAgreementCreateBody = Static<
  typeof AdminConsignorAgreementCreateBodySchema
>;

/** Replacing an agreement adds its next version; `expectedVersion` is the one staff read. */
export const AdminConsignorAgreementReplaceBodySchema = Type.Object(
  { expectedVersion: Type.Integer({ minimum: 1 }), ...TermsFields },
  { additionalProperties: false },
);
export type AdminConsignorAgreementReplaceBody = Static<
  typeof AdminConsignorAgreementReplaceBodySchema
>;

export const AdminConsignorAgreementRetireBodySchema = Type.Object(
  { expectedVersion: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false },
);
export type AdminConsignorAgreementRetireBody = Static<
  typeof AdminConsignorAgreementRetireBodySchema
>;

/** Who consigned an original. */
export const AdminConsignorSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("client"),
      partyId: Type.String({ format: "uuid" }),
      displayName: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object({ kind: Type.Literal("lax") }, { additionalProperties: false }),
]);
export type AdminConsignor = Static<typeof AdminConsignorSchema>;

export const AdminConsignorChangeSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    consignor: AdminConsignorSchema,
    /** Null for the first time it was set. */
    changeReason: Type.Union([Type.String(), Type.Null()]),
    setAt: Type.String({ format: "date-time" }),
    /** Staff display name, or null when the account is gone. */
    setByName: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type AdminConsignorChange = Static<typeof AdminConsignorChangeSchema>;

/** The Consignor field on a From Zoho record, with its history newest first. */
export const AdminArtworkConsignorSchema = Type.Object(
  {
    registerId: Type.String({ format: "uuid" }),
    /** Null: no one has said who consigned the work yet. */
    current: Type.Union([AdminConsignorChangeSchema, Type.Null()]),
    history: Type.Array(AdminConsignorChangeSchema),
  },
  { additionalProperties: false },
);
export type AdminArtworkConsignor = Static<typeof AdminArtworkConsignorSchema>;

/** "Set consignor": a reason is needed for every change after the first. */
export const AdminArtworkConsignorSetBodySchema = Type.Object(
  {
    consignor: Type.Union([
      Type.Object(
        { kind: Type.Literal("client"), partyId: Type.String({ format: "uuid" }) },
        { additionalProperties: false },
      ),
      Type.Object({ kind: Type.Literal("lax") }, { additionalProperties: false }),
    ]),
    reason: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
  },
  { additionalProperties: false },
);
export type AdminArtworkConsignorSetBody = Static<typeof AdminArtworkConsignorSetBodySchema>;

/**
 * 400 body of an agreement or consignor write: `issues` names each field at fault with the
 * sentence to show beside it. A body the route's schema refuses has no `issues`.
 */
export const AdminConsignorAgreementValidationSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  issues: Type.Optional(Type.Array(Type.Object({ field: Type.String(), message: Type.String() }))),
});
export type AdminConsignorAgreementValidation = Static<
  typeof AdminConsignorAgreementValidationSchema
>;
