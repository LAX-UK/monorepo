import { type Static, Type } from "@sinclair/typebox";
import { ConsignmentPlaceSchema } from "./admin-consignor-agreement.js";

/**
 * What a move dialog in LAX Admin ("Offer at auction", "Offer on lax.art") reads about the work's
 * consignor agreement (ZI-5, decision pack 17 November 2026, section 1, option B). shop-api works
 * out the state and the outcome; the dialog only words them.
 *
 * The consignor's name and the agreement's terms are sent only to people who may read that
 * client's agreements (`consignor_agreement.manage`, or `consignor_agreement.read` for a client
 * they can open: a broker only for their own clients). Anyone who can check the work gets the
 * state and the outcome. The lowest price goes to people who may read the agreement and to people
 * who hold every capability the move itself requires (the capabilities its POST route checks),
 * since the dialog compares the starting price with it; for everyone else it is null.
 */

export const AdminMoveAgreementStateSchema = Type.Union([
  Type.Literal("in_force"),
  Type.Literal("not_started"),
  Type.Literal("expired"),
  Type.Literal("retired"),
  Type.Literal("none"),
  Type.Literal("no_consignor"),
  Type.Literal("lax_owns"),
]);
export type AdminMoveAgreementState = Static<typeof AdminMoveAgreementStateSchema>;

const Day = Type.String({ format: "date" });

export const AdminMoveAgreementSchema = Type.Object(
  {
    place: Type.Union([Type.Literal("lax_bid"), Type.Literal("lax_art")]),
    state: AdminMoveAgreementStateSchema,
    /**
     * `allowed`: the move goes ahead. `checkbox_fallback`: no consignor is set and the transition
     * period is still running, so staff tick "The consignor agreed". `blocked`: refused until an
     * agreement or a consignor is recorded.
     */
    outcome: Type.Union([
      Type.Literal("allowed"),
      Type.Literal("checkbox_fallback"),
      Type.Literal("blocked"),
    ]),
    /** The last London day the checkbox fallback is offered (`YYYY-MM-DD`). */
    checkboxFallbackUntil: Day,
    /** The client who consigned the work; null when none is set, LAX owns it or it is not shown. */
    consignor: Type.Union([
      Type.Object({ partyId: Type.String({ format: "uuid" }), displayName: Type.String() }),
      Type.Null(),
    ]),
    /** The agreement the state is about; null when there is none or it is not shown. */
    agreement: Type.Union([
      Type.Object({
        id: Type.String({ format: "uuid" }),
        agreementId: Type.String({ format: "uuid" }),
        version: Type.Integer({ minimum: 1 }),
        places: Type.Array(ConsignmentPlaceSchema, { minItems: 1, maxItems: 3 }),
        startsOn: Day,
        endsOn: Type.Union([Day, Type.Null()]),
        /** The London day it was retired, for a retired agreement. */
        retiredOn: Type.Union([Day, Type.Null()]),
      }),
      Type.Null(),
    ]),
    /**
     * The lowest price agreed, in pence, for an agreement in force that sets one. Null as well for
     * someone who may neither read the agreement nor make the move.
     */
    lowestPricePence: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    /** Whether this person may add an agreement for the consignor (the "Add agreement" link). */
    canAddAgreement: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type AdminMoveAgreement = Static<typeof AdminMoveAgreementSchema>;
