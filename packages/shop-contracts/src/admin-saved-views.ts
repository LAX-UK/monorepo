import { type Static, Type } from "@sinclair/typebox";

/** Lists in LAX Admin that staff can save views for. Anything else is rejected. */
export const ADMIN_SAVED_VIEW_LIST_KEYS = ["lax-admin.orders", "lax-admin.staff"] as const;
export type AdminSavedViewListKey = (typeof ADMIN_SAVED_VIEW_LIST_KEYS)[number];

export const ADMIN_SAVED_VIEWS_PER_LIST_MAX = 50;
export const ADMIN_SAVED_VIEW_LABEL_MAX = 40;
export const ADMIN_SAVED_VIEW_QUERY_MAX = 1000;

const ListKeySchema = Type.Union(ADMIN_SAVED_VIEW_LIST_KEYS.map((key) => Type.Literal(key)));
const LabelSchema = Type.String({ minLength: 1, maxLength: ADMIN_SAVED_VIEW_LABEL_MAX });
const IdSchema = Type.String({ format: "uuid" });

export const AdminSavedViewSchema = Type.Object({
  id: IdSchema,
  listKey: ListKeySchema,
  label: Type.String(),
  /** URL search params (no leading "?") that define the view. */
  query: Type.String(),
  position: Type.Integer(),
});
export type AdminSavedView = Static<typeof AdminSavedViewSchema>;

export const AdminSavedViewListSchema = Type.Object({ items: Type.Array(AdminSavedViewSchema) });
export type AdminSavedViewList = Static<typeof AdminSavedViewListSchema>;

export const AdminSavedViewListQuerySchema = Type.Object({ listKey: ListKeySchema });

export const AdminSavedViewIdParamsSchema = Type.Object({ id: IdSchema });

export const AdminSavedViewCreateBodySchema = Type.Object({
  listKey: ListKeySchema,
  label: LabelSchema,
  query: Type.String({ maxLength: ADMIN_SAVED_VIEW_QUERY_MAX }),
});
export type AdminSavedViewCreateBody = Static<typeof AdminSavedViewCreateBodySchema>;

export const AdminSavedViewRenameBodySchema = Type.Object({ label: LabelSchema });

export const AdminSavedViewReorderBodySchema = Type.Object({
  listKey: ListKeySchema,
  ids: Type.Array(IdSchema, { maxItems: ADMIN_SAVED_VIEWS_PER_LIST_MAX }),
});
