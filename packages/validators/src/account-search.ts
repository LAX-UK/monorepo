import { ACCOUNT_SEARCH_GROUPS, ACCOUNT_SEARCH_MAX_LENGTH } from "@auction/domain";
import { z } from "zod";

/** Results per group when every group is searched at once (the palette's sections). */
export const ACCOUNT_SEARCH_OVERVIEW_LIMIT = 5;
/** The most results one page of a single group returns. */
export const ACCOUNT_SEARCH_PAGE_MAX = 50;

/**
 * `GET /legal-entities/search`: the text, and optionally one group to page through. Without a
 * group, every group the member may search returns its first few results. Text longer than the
 * domain's cap is accepted and cut there, so a pasted value never fails.
 */
export const accountSearchQuerySchema = z
  .object({
    q: z.string().max(ACCOUNT_SEARCH_MAX_LENGTH * 4),
    group: z.enum(ACCOUNT_SEARCH_GROUPS).optional(),
    limit: z.coerce.number().int().min(1).max(ACCOUNT_SEARCH_PAGE_MAX).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export type AccountSearchQuery = z.infer<typeof accountSearchQuerySchema>;
