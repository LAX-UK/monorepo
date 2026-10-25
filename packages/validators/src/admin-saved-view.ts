import { z } from "zod";

/** Lists in Bid admin that staff can save views for. Anything else is rejected. */
export const ADMIN_SAVED_VIEW_LIST_KEYS = [
  "bid-admin.lots",
  "bid-admin.clients",
  "bid-admin.submissions",
] as const;
export type AdminSavedViewListKey = (typeof ADMIN_SAVED_VIEW_LIST_KEYS)[number];

export const ADMIN_SAVED_VIEWS_PER_LIST_MAX = 50;
export const ADMIN_SAVED_VIEW_LABEL_MAX = 40;
export const ADMIN_SAVED_VIEW_QUERY_MAX = 1000;

export const adminSavedViewListKeySchema = z.enum(ADMIN_SAVED_VIEW_LIST_KEYS);

const labelSchema = z
  .string()
  .trim()
  .min(1, "Name the view")
  .max(ADMIN_SAVED_VIEW_LABEL_MAX, `Use ${ADMIN_SAVED_VIEW_LABEL_MAX} characters or fewer`);

/** URL search params without the leading "?", as the list page reads them. */
const querySchema = z
  .string()
  .max(ADMIN_SAVED_VIEW_QUERY_MAX)
  .transform((value) => value.replace(/^\?/, ""))
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Invalid query");

export const adminSavedViewListQuerySchema = z.object({ listKey: adminSavedViewListKeySchema });

export const adminSavedViewIdParamSchema = z.object({ id: z.string().uuid() });

export const adminSavedViewCreateBodySchema = z.object({
  listKey: adminSavedViewListKeySchema,
  label: labelSchema,
  query: querySchema,
});

export const adminSavedViewRenameBodySchema = z.object({ label: labelSchema });

export const adminSavedViewReorderBodySchema = z.object({
  listKey: adminSavedViewListKeySchema,
  ids: z.array(z.string().uuid()).max(ADMIN_SAVED_VIEWS_PER_LIST_MAX),
});

export type AdminSavedViewCreateBody = z.infer<typeof adminSavedViewCreateBodySchema>;

/** A saved view as the admin receives it. */
export type AdminSavedViewDto = {
  id: string;
  listKey: AdminSavedViewListKey;
  label: string;
  query: string;
  position: number;
};
