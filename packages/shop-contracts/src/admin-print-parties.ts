import { type Static, Type } from "@sinclair/typebox";

/** The longest a printer or publisher name may be; the same limit as the facts that store it. */
export const PRINT_PARTY_NAME_MAX_LENGTH = 80;

/** A studio or publisher staff pick "Printed by" and "Published by" from. */
export const AdminPrintPartySchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  name: Type.String({ minLength: 1, maxLength: PRINT_PARTY_NAME_MAX_LENGTH }),
});
export type AdminPrintParty = Static<typeof AdminPrintPartySchema>;

export const AdminPrintPartyListSchema = Type.Object({
  items: Type.Array(AdminPrintPartySchema),
});
export type AdminPrintPartyList = Static<typeof AdminPrintPartyListSchema>;

export const AdminPrintPartyCreateBodySchema = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: PRINT_PARTY_NAME_MAX_LENGTH }) },
  { additionalProperties: false },
);
export type AdminPrintPartyCreateBody = Static<typeof AdminPrintPartyCreateBodySchema>;
