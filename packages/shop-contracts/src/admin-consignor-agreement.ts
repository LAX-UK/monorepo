import { type Static, Type } from "@sinclair/typebox";

/**
 * Consignor agreements in LAX Admin (register item ZI-5, docs/design/decision-pack-2026-11-17.md
 * section 1, option B). A consignor is a client (`clients/[partyId]`); an agreement records the
 * places LAX may offer their works, from and until when, an optional lowest price and commission,
 * the signed file and a note. It is replaced by a new version, never edited in place, and retired
 * rather than deleted. Each original in the register names its consignor: a client, or "LAX owns
 * this work".
 *
 * Served under `/admin/v1/clients/:partyId/consignor-agreements`. The terms are checked again by `parseAgreementTerms` in
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
    /** The consignor, so a page can name them without reading the rest of the client record. */
    party: Type.Object(
      { partyId: Type.String({ format: "uuid" }), displayName: Type.String() },
      { additionalProperties: false },
    ),
    /** Current versions first, then retired ones, newest first. Replaced versions are left out. */
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

/**
 * A client consignor's agreement as the From Zoho record shows it: where and when it lets LAX
 * offer their works, enough to say whether it is in force. The terms, the signed file and the note
 * stay on the client's page.
 */
export const AdminArtworkConsignorAgreementSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    status: Type.Literal("current"),
    places: Type.Array(ConsignmentPlaceSchema, { minItems: 1, maxItems: 3, uniqueItems: true }),
    startsOn: Day,
    /** Null: until retired. */
    endsOn: NullableDay,
    createdAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);
export type AdminArtworkConsignorAgreement = Static<typeof AdminArtworkConsignorAgreementSchema>;

/** The Consignor field on a From Zoho record, with its history newest first. */
export const AdminArtworkConsignorSchema = Type.Object(
  {
    registerId: Type.String({ format: "uuid" }),
    /** Null: no one has said who consigned the work yet. */
    current: Type.Union([AdminConsignorChangeSchema, Type.Null()]),
    /** Newest first, `current` included; the oldest changes are left out past a limit. */
    history: Type.Array(AdminConsignorChangeSchema),
    /** True when older changes were left out of `history`. */
    moreHistory: Type.Boolean(),
    /**
     * The client consignor's agreements that are not replaced or retired, so the record can say
     * whether one is in force today. Empty for LAX, or when no consignor is set.
     */
    agreements: Type.Array(AdminArtworkConsignorAgreementSchema),
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
    reason: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
    /**
     * The change staff were looking at (`current.id`), or null when no consignor was set. When
     * the consignor has changed since, the write is refused with 409 rather than overwriting it.
     */
    expectedCurrentId: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
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

/** The file types a signed agreement may be, and its largest size. */
export const CONSIGNOR_AGREEMENT_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export const CONSIGNOR_AGREEMENT_FILE_MAX_BYTES = 20 * 1024 * 1024;

/** Asking where to upload a signed agreement for the client; the key goes in the add body. */
export const AdminConsignorAgreementFileUploadBodySchema = Type.Object(
  {
    contentType: Type.Union(CONSIGNOR_AGREEMENT_FILE_TYPES.map((type) => Type.Literal(type))),
    byteSize: Type.Integer({ minimum: 1, maximum: CONSIGNOR_AGREEMENT_FILE_MAX_BYTES }),
  },
  { additionalProperties: false },
);
export type AdminConsignorAgreementFileUploadBody = Static<
  typeof AdminConsignorAgreementFileUploadBodySchema
>;

export const AdminConsignorAgreementFileUploadSchema = Type.Object(
  {
    key: Type.String({ minLength: 1, maxLength: 512 }),
    /** A short-lived signed PUT; send the file with exactly `requiredHeaders`. */
    uploadUrl: Type.String(),
    requiredHeaders: Type.Record(Type.String(), Type.String()),
  },
  { additionalProperties: false },
);
export type AdminConsignorAgreementFileUpload = Static<
  typeof AdminConsignorAgreementFileUploadSchema
>;

/** A short-lived link to download one version's signed file. Never stored. */
export const AdminConsignorAgreementFileLinkSchema = Type.Object(
  {
    url: Type.String(),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);
export type AdminConsignorAgreementFileLink = Static<typeof AdminConsignorAgreementFileLinkSchema>;

export const AdminConsignorAgreementVersionParamsSchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
  versionId: Type.String({ format: "uuid" }),
});
export type AdminConsignorAgreementVersionParams = Static<
  typeof AdminConsignorAgreementVersionParamsSchema
>;

export const AdminConsignorAgreementPartyParamsSchema = Type.Object({
  partyId: Type.String({ format: "uuid" }),
});

/**
 * 409 of a replace or retire: a stale version also says the version the agreement is at. A
 * consignor change made meanwhile is a 409 with the id of the change now current.
 */
export const AdminConsignorAgreementConflictSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: Type.Optional(Type.String()),
});
