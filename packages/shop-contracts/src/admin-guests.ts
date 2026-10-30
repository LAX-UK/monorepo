import { type Static, Type } from "@sinclair/typebox";

export const AdminGuestParamsSchema = Type.Object({
  guestCustomerId: Type.String({ format: "uuid" }),
});

/** Whether staff can erase this guest's personal data now, and if not, why. */
export const AdminGuestErasureStateSchema = Type.Object({
  guestCustomerId: Type.String({ format: "uuid" }),
  erasedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  allowed: Type.Boolean(),
  blockedReason: Type.Union([
    Type.Literal("already_erased"),
    Type.Literal("claimed"),
    Type.Literal("open_order"),
    Type.Null(),
  ]),
  /** A sentence staff can act on; null when erasure is allowed. */
  blockedMessage: Type.Union([Type.String(), Type.Null()]),
});

/** Staff type the guest's email to confirm, and say why, for the audit log. */
export const AdminGuestErasureBodySchema = Type.Object({
  confirmation: Type.String({ minLength: 1, maxLength: 254 }),
  reason: Type.String({ minLength: 1, maxLength: 500 }),
});

export const AdminGuestErasureResultSchema = Type.Object({
  guestCustomerId: Type.String({ format: "uuid" }),
  erasedAt: Type.String({ format: "date-time" }),
  orders: Type.Integer({ minimum: 0 }),
  enquiries: Type.Integer({ minimum: 0 }),
  links: Type.Integer({ minimum: 0 }),
});

export type AdminGuestErasureState = Static<typeof AdminGuestErasureStateSchema>;
export type AdminGuestErasureBody = Static<typeof AdminGuestErasureBodySchema>;
export type AdminGuestErasureResult = Static<typeof AdminGuestErasureResultSchema>;
