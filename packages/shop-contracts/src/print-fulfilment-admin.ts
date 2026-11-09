import { type Static, Type } from "@sinclair/typebox";

/**
 * Staff contracts for fulfilling the exact print that was sold: the pick list for an order,
 * confirming the print in hand against the line, sending another print in its place, and the
 * certificate each confirmed print gets.
 */

export const PRINT_SCAN_MAX_LENGTH = 64;
export const SWAP_REASON_FIELD_MAX = 300;

export const AdminCertificateStatusSchema = Type.Union([
  /** The run has no certificate. */
  Type.Literal("none"),
  /** Not yet known: the print has not been confirmed. */
  Type.Literal("pending_confirmation"),
  Type.Literal("issued"),
  /** Recorded and waiting for staff or the issuer to send it. */
  Type.Literal("to_send"),
  /** Cannot be issued until something is put right; `note` says what. */
  Type.Literal("blocked"),
]);
export type AdminCertificateStatus = Static<typeof AdminCertificateStatusSchema>;

export const AdminLineCertificateSchema = Type.Object({
  status: AdminCertificateStatusSchema,
  certificateId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  /** One plain sentence for the pick list. */
  note: Type.Union([Type.String(), Type.Null()]),
  issuedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});
export type AdminLineCertificate = Static<typeof AdminLineCertificateSchema>;

export const AdminPickLineSchema = Type.Object({
  orderLineId: Type.String({ format: "uuid" }),
  artworkId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  artworkTitle: Type.String(),
  /** "7/24", "AP 2/3" or "OE-0021". */
  label: Type.String(),
  /** Whether the run numbers its prints, so packing checks the number. */
  numbered: Type.Boolean(),
  /** Where the print is kept, or null when it is printed to order. */
  storageLocation: Type.Union([Type.String(), Type.Null()]),
  printedToOrder: Type.Boolean(),
  confirmedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  confirmedBy: Type.Union([Type.String(), Type.Null()]),
  /** The label this line was moved from, when another print was sent in its place. */
  replacedLabel: Type.Union([Type.String(), Type.Null()]),
  certificate: AdminLineCertificateSchema,
  /** The line was released or cancelled, so there is nothing to pack. */
  cancelled: Type.Boolean(),
});
export type AdminPickLine = Static<typeof AdminPickLineSchema>;

export const AdminPickAndPackSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  lines: Type.Array(AdminPickLineSchema),
});
export type AdminPickAndPack = Static<typeof AdminPickAndPackSchema>;

export const AdminConfirmPrintBodySchema = Type.Object(
  {
    /** What was scanned from the stock label, or typed from what is written on the print. */
    source: Type.Union([Type.Literal("label_code"), Type.Literal("typed_label")]),
    value: Type.String({ minLength: 1, maxLength: PRINT_SCAN_MAX_LENGTH }),
  },
  { additionalProperties: false },
);
export type AdminConfirmPrintBody = Static<typeof AdminConfirmPrintBodySchema>;

const SwapTargetSchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  label: Type.String(),
});

export const AdminConfirmPrintResponseSchema = Type.Union([
  Type.Object({
    outcome: Type.Literal("confirmed"),
    label: Type.String(),
    certificate: AdminLineCertificateSchema,
  }),
  /** The print in hand is not the one sold, and cannot stand in for it. */
  Type.Object({
    outcome: Type.Literal("wrong_print"),
    reason: Type.String(),
    scannedLabel: Type.Union([Type.String(), Type.Null()]),
  }),
  /** The print in hand is free to send instead; `needsAdmin` when its owner differs. */
  Type.Object({
    outcome: Type.Literal("swap_available"),
    needsAdmin: Type.Boolean(),
    to: SwapTargetSchema,
    reason: Type.String(),
  }),
]);
export type AdminConfirmPrintResponse = Static<typeof AdminConfirmPrintResponseSchema>;

export const AdminSwapPrintBodySchema = Type.Object(
  {
    /** The print to send. Left out, the next free print is chosen. */
    toEditionId: Type.Optional(Type.String({ format: "uuid" })),
    reason: Type.String({ minLength: 1, maxLength: SWAP_REASON_FIELD_MAX }),
  },
  { additionalProperties: false },
);
export type AdminSwapPrintBody = Static<typeof AdminSwapPrintBodySchema>;

export const AdminSwapPrintResponseSchema = Type.Object({
  label: Type.String(),
  previousLabel: Type.String(),
  /** The seller and the pending payout moved to the new print's owner. */
  payoutMoved: Type.Boolean(),
  /** The buyer was emailed, because the number had already been shown to them. */
  buyerNotified: Type.Boolean(),
});
export type AdminSwapPrintResponse = Static<typeof AdminSwapPrintResponseSchema>;

export const AdminCertificateToSendSchema = Type.Object({
  certificateId: Type.String({ format: "uuid" }),
  orderId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  orderReference: Type.Union([Type.String(), Type.Null()]),
  artworkTitle: Type.String(),
  label: Type.String(),
  issuer: Type.Union([Type.String(), Type.Null()]),
  form: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
});
export type AdminCertificateToSend = Static<typeof AdminCertificateToSendSchema>;

export const AdminCertificatesToSendSchema = Type.Object({
  items: Type.Array(AdminCertificateToSendSchema),
});
export type AdminCertificatesToSend = Static<typeof AdminCertificatesToSendSchema>;

export const AdminHorsCommerceApprovalResponseSchema = Type.Object({
  approvedAt: Type.String({ format: "date-time" }),
  approvedBy: Type.String(),
});
export type AdminHorsCommerceApprovalResponse = Static<
  typeof AdminHorsCommerceApprovalResponseSchema
>;
