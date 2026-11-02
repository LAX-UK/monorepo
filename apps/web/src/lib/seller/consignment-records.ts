import { formatLotMoment } from "@/lib/bid/lot-moment";
import {
  formatEstimateRangeShort,
  formatWholeMoney,
  lotChargeCurrency,
} from "@/lib/format-currency";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { lotPath } from "@/lib/seo/url";
import {
  type ConsignedLotScope,
  type ConsignmentProgressStage,
  type NeedsYouTask,
  canSeeConsignedLot,
  lotProgressStage,
  submissionProgressStage,
} from "@auction/domain";
import type {
  ConsignmentAgreement,
  ItemSubmission,
  Lot,
  SellerUnsoldOutcome,
} from "@auction/types";
import {
  CONSIGNMENT_STATUS,
  type ConsignmentStage,
  type ConsignmentStatus,
  consignmentStatus,
} from "./consignment-status";

/** What a consignment waits on its seller for, the reason it is in "Needs you". */
export type ConsignmentTask = "changes" | "agreement" | "unsold" | "reply";

/**
 * The consignments waiting on the member, by what they wait for: submissions sent back,
 * agreements to accept and specialists' messages to read (by submission id), and unsold lots to
 * decide (by lot id).
 */
export type ConsignmentTasks = {
  changes: ReadonlySet<string>;
  agreements: ReadonlySet<string>;
  unsoldLots: ReadonlySet<string>;
  replies: ReadonlySet<string>;
};

export const NO_CONSIGNMENT_TASKS: ConsignmentTasks = {
  changes: new Set(),
  agreements: new Set(),
  unsoldLots: new Set(),
  replies: new Set(),
};

/** One consignment in the list: a submission while it is reviewed, then its lot. */
export type ConsignmentRecord = {
  /** Stable across both sources: a submission and a lot may share an id space. */
  key: string;
  submissionId: string | null;
  lotId: string | null;
  title: string;
  image: string | null;
  /** "C-1042", the reference a seller quotes to the specialist. */
  reference: string | null;
  /** The member who sent it. */
  sentBy: string | null;
  saleTitle: string | null;
  status: ConsignmentStatus;
  stage: ConsignmentStage;
  /** Where it is in review, for the stage links from Home; `null` outside review. */
  progress: ConsignmentProgressStage | null;
  /** The date that matters now, with what it is: "choose by 12 Nov", "sold 22 Oct". */
  moment: { value: string; label: string };
  /**
   * The estimate, or the hammer once it sold. Without one, `empty` names why in words ("Estimate
   * after review"), never a dash under a label.
   */
  price: { value: string; label: string } | { empty: string };
  task: ConsignmentTask | null;
  /** The consignment's page; a lot with no submission behind it opens the lot. */
  href: string;
  lotHref: string | null;
  /** The agreement as a PDF, once the specialist proposed one. */
  agreementHref: string | null;
  /** For sorting: when it last changed, and when it was sent. */
  changedAt: number;
  sentAt: number;
};

export type ConsignmentSources = {
  submissions: readonly ItemSubmission[];
  lots: readonly Lot[];
  agreements: readonly ConsignmentAgreement[];
  unsold: readonly SellerUnsoldOutcome[];
  saleTitleById: Readonly<Record<string, string>>;
  tasks: ConsignmentTasks;
  now: Date;
};

/** The consignment's own page. */
export function consignmentHref(submissionId: string): string {
  return `${CLIENT_ROUTES.consignments}/${encodeURIComponent(submissionId)}`;
}

/** Where the member makes the changes: the Sell a work form on this consignment, at its last step. */
export function consignmentEditHref(submissionId: string): string {
  return `${consignmentHref(submissionId)}/edit`;
}

/** The agreement PDF, through the app so the member's session goes with it. */
export function consignmentAgreementHref(submissionId: string): string {
  return `${consignmentHref(submissionId)}/agreement`;
}

/** The consignment's Messages tab. */
export function consignmentMessagesHref(submissionId: string): string {
  return `${consignmentHref(submissionId)}?tab=messages`;
}

/** The consignment's Documents tab. */
export function consignmentDocumentsHref(submissionId: string): string {
  return `${consignmentHref(submissionId)}?tab=documents`;
}

/** The consignment's History tab. */
export function consignmentHistoryHref(submissionId: string): string {
  return `${consignmentHref(submissionId)}?tab=history`;
}

function day(date: Date, now: Date): string {
  return formatLotMoment(date, now, { time: false });
}

function agreementState(agreement: ConsignmentAgreement | undefined) {
  if (!agreement) return "none" as const;
  return agreement.acceptedAt ? ("accepted" as const) : ("open" as const);
}

type Pair = { submission: ItemSubmission | null; lot: Lot | null };

/** The date that matters for a status, so the list reads "what next, by when". */
function momentOf(
  status: ConsignmentStatus,
  { submission, lot }: Pair,
  unsold: SellerUnsoldOutcome | undefined,
  now: Date,
): ConsignmentRecord["moment"] {
  if (lot && (status === "in_sale" || status === "live")) {
    return status === "live"
      ? { value: day(lot.endTime, now), label: "closes" }
      : { value: day(lot.startTime, now), label: "opens" };
  }
  if (lot && status === "sold") return { value: day(lot.endTime, now), label: "sold" };
  if (status === "choose_unsold" && unsold) {
    return { value: day(new Date(unsold.chooseBy), now), label: "choose by" };
  }
  if (lot && (status === "unsold" || status === "choose_unsold")) {
    return { value: day(lot.endTime, now), label: "ended" };
  }
  if (submission?.status === "draft") {
    return { value: day(submission.createdAt, now), label: "started" };
  }
  if (status === "needs_changes" && submission?.changesRequestedAt) {
    return { value: day(submission.changesRequestedAt, now), label: "sent back" };
  }
  if (CONSIGNMENT_STATUS[status].stage === "closed") {
    return { value: day((submission?.updatedAt ?? lot?.endTime) as Date, now), label: "closed" };
  }
  return { value: day((submission?.createdAt ?? lot?.startTime) as Date, now), label: "sent" };
}

function priceOf(
  status: ConsignmentStatus,
  { lot }: Pair,
  agreement: ConsignmentAgreement | undefined,
): ConsignmentRecord["price"] {
  if (lot && status === "sold") {
    const hammer = lot.checkoutPricing?.hammerMajor ?? lot.currentPrice;
    return { value: formatWholeMoney(hammer, lotChargeCurrency(lot)), label: "hammer" };
  }
  const estimate =
    lot?.marketingDetails?.estimate ??
    (agreement?.estimateLow && agreement.estimateHigh
      ? { low: agreement.estimateLow, high: agreement.estimateHigh, currency: agreement.currency }
      : null);
  if (estimate) return { value: formatEstimateRangeShort(estimate), label: "estimate" };
  const stage = CONSIGNMENT_STATUS[status].stage;
  const reviewing = stage === "in-review" || stage === "accepted" || stage === "drafts";
  return { empty: reviewing ? "Estimate after review" : "No estimate" };
}

function taskOf(pair: Pair, tasks: ConsignmentTasks): ConsignmentTask | null {
  if (pair.lot && tasks.unsoldLots.has(pair.lot.id)) return "unsold";
  const id = pair.submission?.id;
  if (!id) return null;
  if (tasks.agreements.has(id)) return "agreement";
  if (tasks.changes.has(id)) return "changes";
  if (tasks.replies.has(id)) return "reply";
  return null;
}

function record(
  pair: Pair,
  sources: ConsignmentSources,
  agreements: Map<string, ConsignmentAgreement>,
  unsoldByLot: Map<string, SellerUnsoldOutcome>,
): ConsignmentRecord {
  const { submission, lot } = pair;
  const agreement = submission ? agreements.get(submission.id) : undefined;
  const unsold = lot ? unsoldByLot.get(lot.id) : undefined;
  const status = consignmentStatus({
    submission: submission?.status ?? null,
    agreement: agreementState(agreement),
    lot: lot ? { status: lot.status, sold: Boolean(lot.winnerId ?? lot.hasWinner) } : null,
    unsoldChoice: unsold ? (unsold.choice === "none" ? "none" : "made") : null,
  });
  const lotHref = lot ? lotPath({ id: lot.id, title: lot.title }) : null;
  const saleId = lot?.saleId ?? null;
  return {
    key: submission ? `submission:${submission.id}` : `lot:${lot?.id}`,
    submissionId: submission?.id ?? null,
    lotId: lot?.id ?? null,
    title: lot?.title ?? submission?.title ?? "",
    image: lot?.images[0] ?? submission?.images[0] ?? null,
    reference: submission?.reference ?? null,
    sentBy: submission?.sentBy?.name ?? null,
    saleTitle: saleId ? (sources.saleTitleById[saleId] ?? null) : null,
    status,
    stage: CONSIGNMENT_STATUS[status].stage,
    progress: lot
      ? lotProgressStage({ status: lot.status, sold: status === "sold" })
      : submission
        ? submissionProgressStage(submission.status)
        : null,
    moment: momentOf(status, pair, unsold, sources.now),
    price: priceOf(status, pair, agreement),
    task: taskOf(pair, sources.tasks),
    href: submission ? consignmentHref(submission.id) : (lotHref ?? CLIENT_ROUTES.consignments),
    lotHref,
    agreementHref: agreement && submission ? consignmentAgreementHref(submission.id) : null,
    changedAt: Math.max(submission?.updatedAt.getTime() ?? 0, lot?.endTime.getTime() ?? 0),
    sentAt: (submission?.createdAt ?? lot?.startTime ?? new Date(0)).getTime(),
  };
}

/**
 * Submissions and their lots as one list of consignments, most recently changed first. A
 * submission that became a lot appears once, as the lot with its submission behind it.
 */
export function buildConsignmentRecords(sources: ConsignmentSources): ConsignmentRecord[] {
  const agreements = new Map(sources.agreements.map((a) => [a.submissionId, a]));
  const unsoldByLot = new Map(sources.unsold.map((u) => [u.lotId, u]));
  const lotById = new Map(sources.lots.map((lot) => [lot.id, lot]));
  const covered = new Set<string>();
  const pairs: Pair[] = sources.submissions.map((submission) => {
    const lot = submission.convertedLotId ? (lotById.get(submission.convertedLotId) ?? null) : null;
    if (lot) covered.add(lot.id);
    return { submission, lot };
  });
  for (const lot of sources.lots) {
    if (!covered.has(lot.id)) pairs.push({ submission: null, lot });
  }
  return pairs
    .map((pair) => record(pair, sources, agreements, unsoldByLot))
    .sort((a, b) => b.changedAt - a.changedAt);
}

/**
 * The lots the member may see: a consignor sees only the lots made from submissions they sent;
 * owners, admins and viewers see them all.
 */
export function visibleConsignedLots(input: {
  lots: readonly Lot[];
  submissions: readonly ItemSubmission[];
  scope: ConsignedLotScope;
  viewerUserId: string;
}): Lot[] {
  if (input.scope === "all") return [...input.lots];
  const senderByLot = new Map(
    input.submissions.flatMap((s) =>
      s.convertedLotId ? [[s.convertedLotId, s.submittedByUserId ?? null] as const] : [],
    ),
  );
  return input.lots.filter((lot) =>
    canSeeConsignedLot({
      scope: input.scope,
      submittedByUserId: senderByLot.get(lot.id),
      viewerUserId: input.viewerUserId,
    }),
  );
}

/**
 * What waits on the member, from the one Needs-you reader (a person's own account reads it too),
 * so the list, Home and the sidebar count always agree.
 */
export function consignmentTasksFromNeedsYou(tasks: readonly NeedsYouTask[]): ConsignmentTasks {
  const changes = new Set<string>();
  const agreements = new Set<string>();
  const unsoldLots = new Set<string>();
  const replies = new Set<string>();
  for (const task of tasks) {
    if (task.kind === "changes") changes.add(task.submission.id);
    else if (task.kind === "agreement") agreements.add(task.consignment.id);
    else if (task.kind === "reply") replies.add(task.consignment.id);
    else if (task.kind === "unsold" || task.kind === "unsold_due") {
      for (const lot of task.lots) unsoldLots.add(lot.id);
    }
  }
  return { changes, agreements, unsoldLots, replies };
}
