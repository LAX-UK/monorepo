import type { NeedsYouKind, NeedsYouLink, NeedsYouTask } from "@auction/domain";
import { z } from "zod";
import { NEEDS_YOU_SECTIONS, type NeedsYouCounts } from "./needs-you-counts";

/**
 * The one Needs-you reader's answer (`GET /legal-entities/needs-you`), as Home and the sidebar
 * read it: the kinds the member can be asked for, the tasks waiting now (ranked, each with where
 * its button leads), the counts per section and whether a list was longer than the reader reads.
 * Home and the sidebar parse the same response, so they can never disagree.
 */
export type NeedsYouTaskWithLink = NeedsYouTask & { link: NeedsYouLink };

export type NeedsYouResponse = {
  kinds: NeedsYouKind[];
  tasks: NeedsYouTaskWithLink[];
  counts: NeedsYouCounts;
  truncated: boolean;
};

const subject = z.object({ id: z.string(), title: z.string() });
const date = z.coerce.date();

const link = z.discriminatedUnion("page", [
  z.object({ page: z.literal("lot"), id: z.string() }),
  z.object({ page: z.literal("bids") }),
  z.object({ page: z.literal("purchase"), id: z.string() }),
  z.object({ page: z.literal("purchases") }),
  z.object({ page: z.literal("consignment"), id: z.string() }),
  z.object({ page: z.literal("consignments"), view: z.literal("unsold") }),
  z.object({ page: z.literal("sale"), id: z.string() }),
  z.object({ page: z.literal("team"), view: z.enum(["invitations", "who_can_bid"]) }),
  z.object({ page: z.literal("bid_settings") }),
  z.object({ page: z.literal("organisation"), view: z.enum(["documents", "payouts"]) }),
  z.object({ page: z.literal("verify_identity") }),
  z.object({ page: z.literal("source_of_funds") }),
]) satisfies z.ZodType<NeedsYouLink>;

const purchases = z.array(subject);
const withLink = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, link });

const task = z.discriminatedUnion("kind", [
  withLink({
    kind: z.literal("outbid"),
    lots: z.array(subject.extend({ endsAt: date })),
  }),
  withLink({ kind: z.literal("pay"), purchases }),
  withLink({ kind: z.literal("won_awaiting_payment"), purchases }),
  withLink({ kind: z.literal("unsold_due"), lots: z.array(subject), dueBy: date }),
  withLink({ kind: z.literal("agreement"), consignment: subject }),
  withLink({ kind: z.literal("changes"), submission: subject, note: z.string().nullable() }),
  withLink({ kind: z.literal("unsold"), lots: z.array(subject) }),
  withLink({ kind: z.literal("choose_delivery"), purchases }),
  withLink({ kind: z.literal("quote_ready"), purchases }),
  withLink({ kind: z.literal("book_collection"), purchases }),
  withLink({
    kind: z.literal("register"),
    sale: subject,
    startsAt: date,
    bidLimit: z.string().nullable(),
  }),
  withLink({
    kind: z.literal("authorisation_ending"),
    authorisations: z.array(z.object({ id: z.string(), memberName: z.string(), endsAt: date })),
  }),
  withLink({
    kind: z.literal("invitations_expired"),
    invitations: z.array(z.object({ id: z.string(), email: z.string(), expiredAt: date })),
  }),
  withLink({ kind: z.literal("documents") }),
  withLink({ kind: z.literal("identity") }),
  withLink({ kind: z.literal("source_of_funds") }),
  withLink({ kind: z.literal("payouts") }),
]);

/**
 * Tasks are read one by one: a kind this build does not know yet (a newer API) is skipped rather
 * than failing the whole list. The counts still come from the reader.
 */
const response = z.object({
  kinds: z.array(z.string()),
  tasks: z.array(z.unknown()),
  counts: z.record(z.string(), z.number()),
  truncated: z.boolean().default(false),
});

/** The reader's answer from an API body (`{ data }`), or `null` when it is not that shape. */
export function parseNeedsYouResponse(body: unknown): NeedsYouResponse | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = response.safeParse((body as { data: unknown }).data);
  if (!parsed.success) return null;
  const tasks = parsed.data.tasks.flatMap((raw) => {
    const one = task.safeParse(raw);
    return one.success ? [one.data as NeedsYouTaskWithLink] : [];
  });
  const counts: Partial<Record<(typeof NEEDS_YOU_SECTIONS)[number], number>> = {};
  for (const section of NEEDS_YOU_SECTIONS) {
    const value = parsed.data.counts[section];
    if (typeof value === "number") counts[section] = value;
  }
  return {
    kinds: parsed.data.kinds as NeedsYouKind[],
    tasks,
    counts,
    truncated: parsed.data.truncated,
  };
}
