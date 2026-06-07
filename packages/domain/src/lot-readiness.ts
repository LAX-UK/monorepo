import type { ExhibitionEntry, Lot, LotMarketingDetails, ProvenanceEntry } from "@auction/types";

export type LotReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: "required" | "warning";
  /** When set, the seller can act on this item. */
  sellerActionable?: boolean;
};

export type LotReadinessResult = {
  checks: LotReadinessCheck[];
  completeCount: number;
  totalCount: number;
  percent: number;
};

export type LotReadinessInput = Pick<
  Lot,
  | "images"
  | "description"
  | "sellerLegalEntityId"
  | "artistReviewRequired"
  | "saleId"
  | "startTime"
  | "endTime"
> & {
  connectRequired?: boolean;
};

function pct(complete: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((complete / total) * 100);
}

/** Pure publish-readiness rules — shared by admin and seller surfaces. */
export function evaluateLotReadiness(input: LotReadinessInput): LotReadinessResult {
  const connectRequired = input.connectRequired ?? false;
  const scheduleValid = input.endTime.getTime() > input.startTime.getTime();

  const checks: LotReadinessCheck[] = [
    {
      id: "images",
      label: "At least one image",
      ok: input.images.length >= 1,
      severity: "required",
      sellerActionable: true,
    },
    {
      id: "description",
      label: "Catalogue description",
      ok: Boolean(input.description?.trim()),
      severity: "required",
    },
    {
      id: "seller",
      label: connectRequired ? "Stripe Connect completed" : "Seller profile",
      ok: Boolean(input.sellerLegalEntityId) && !connectRequired,
      severity: "required",
      sellerActionable: connectRequired,
    },
    {
      id: "artist",
      label: "Artist assigned / review cleared",
      ok: !input.artistReviewRequired,
      severity: "required",
    },
    {
      id: "sale",
      label: "Assigned to a sale",
      ok: Boolean(input.saleId),
      severity: "warning",
    },
    {
      id: "schedule",
      label: "Valid schedule (end after start)",
      ok: scheduleValid,
      severity: "required",
    },
  ];

  const completeCount = checks.filter((c) => c.ok).length;
  return {
    checks,
    completeCount,
    totalCount: checks.length,
    percent: pct(completeCount, checks.length),
  };
}

function normalizeProvenance(
  entries: ProvenanceEntry[],
): NonNullable<LotMarketingDetails["provenance"]> {
  return entries.map(({ period, note }) => ({
    note,
    ...(period ? { period } : {}),
  }));
}

function normalizeExhibitions(
  entries: ExhibitionEntry[],
): NonNullable<LotMarketingDetails["exhibitions"]> {
  return entries.map(({ year, venue, note }) => ({
    venue,
    ...(year ? { year } : {}),
    ...(note ? { note } : {}),
  }));
}

export function submissionMarketingDetailsFromSubmission(input: {
  provenance?: ProvenanceEntry[];
  exhibitions?: ExhibitionEntry[];
  conditionSelfReport?: string | null;
}): LotMarketingDetails {
  const out: LotMarketingDetails = {};
  if (input.provenance?.length) {
    out.provenance = normalizeProvenance(input.provenance);
  }
  if (input.exhibitions?.length) {
    out.exhibitions = normalizeExhibitions(input.exhibitions);
  }
  const condition = input.conditionSelfReport?.trim();
  if (condition) {
    out.conditionReport = { summary: condition };
  }
  return out;
}
