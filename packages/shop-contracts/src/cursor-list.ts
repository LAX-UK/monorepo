import { type Static, Type } from "@sinclair/typebox";

export const CursorListQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

export function createCursorListResponseSchema<T extends ReturnType<typeof Type.Object>>(
  itemSchema: T,
) {
  return Type.Object({
    items: Type.Array(itemSchema),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
  });
}

export type CursorListQuery = Static<typeof CursorListQuerySchema>;
