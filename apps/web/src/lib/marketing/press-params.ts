import type { CatalogActiveFilterChip } from "@/components/marketing/catalog-active-filter-chips";
import type { SalePressMentionType } from "@auction/types";

export const PRESS_HUB_PAGE_SIZE = 24;

/** Sentinel value for "all" in filter form selects. */
export const PRESS_FILTER_ALL = "__all__";

export const PRESS_MENTION_TYPE_OPTIONS: ReadonlyArray<{
  value: SalePressMentionType;
  label: string;
}> = [
  { value: "feature", label: "Feature" },
  { value: "interview", label: "Interview" },
  { value: "quote", label: "Quote" },
  { value: "roundup", label: "Roundup" },
];

export type PressFilterFormValues = {
  q: string;
  year: string;
  mentionType: string;
};

export type PressHubParams = {
  q: string;
  year: number | null;
  mentionType: SalePressMentionType | null;
  page: number;
};

export function parsePressHubParams(
  searchParams: Record<string, string | string[] | undefined>,
): PressHubParams {
  const rawQ = searchParams.q;
  const q =
    typeof rawQ === "string" ? rawQ.trim() : Array.isArray(rawQ) ? (rawQ[0]?.trim() ?? "") : "";
  const rawYear = searchParams.year;
  const yearStr =
    typeof rawYear === "string" ? rawYear : Array.isArray(rawYear) ? rawYear[0] : undefined;
  const yearParsed = yearStr ? Number.parseInt(yearStr, 10) : Number.NaN;
  const year =
    Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100 ? yearParsed : null;
  const rawPage = searchParams.page;
  const pageStr =
    typeof rawPage === "string" ? rawPage : Array.isArray(rawPage) ? rawPage[0] : undefined;
  const pageParsed = pageStr ? Number.parseInt(pageStr, 10) : Number.NaN;
  const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;
  const rawMentionType = searchParams.mentionType;
  const mentionTypeStr =
    typeof rawMentionType === "string"
      ? rawMentionType
      : Array.isArray(rawMentionType)
        ? rawMentionType[0]
        : undefined;
  const mentionType = PRESS_MENTION_TYPE_OPTIONS.some((opt) => opt.value === mentionTypeStr)
    ? (mentionTypeStr as SalePressMentionType)
    : null;
  return { q, year, mentionType, page };
}

export function getPressMentionTypeLabel(mentionType: SalePressMentionType): string {
  return (
    PRESS_MENTION_TYPE_OPTIONS.find((option) => option.value === mentionType)?.label ?? mentionType
  );
}

export function parsePressFilterYear(value: string): number | null {
  if (!value) return null;
  const yearParsed = Number.parseInt(value, 10);
  return Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100
    ? yearParsed
    : null;
}

export function parsePressFilterMentionType(value: string): SalePressMentionType | null {
  if (!value || value === PRESS_FILTER_ALL) return null;
  return PRESS_MENTION_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as SalePressMentionType)
    : null;
}

export function pressHubParamsToFilterFormValues(params: PressHubParams): PressFilterFormValues {
  return {
    q: params.q,
    year: params.year != null ? String(params.year) : "",
    mentionType: params.mentionType ?? PRESS_FILTER_ALL,
  };
}

export function pressFilterFormValuesToHubParams(values: PressFilterFormValues): PressHubParams {
  return {
    q: values.q.trim(),
    year: parsePressFilterYear(values.year),
    mentionType: parsePressFilterMentionType(values.mentionType),
    page: 1,
  };
}

export function formatPressArticleCount(count: number): string {
  return `${count} article${count === 1 ? "" : "s"}`;
}

export function formatPressApplyButtonLabel(count: number): string {
  return count === 1 ? "Show 1 article" : `Show ${count} articles`;
}

export function buildPressHubQuery(params: PressHubParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.year != null) qs.set("year", String(params.year));
  if (params.mentionType != null) qs.set("mentionType", params.mentionType);
  if (params.page > 1) qs.set("page", String(params.page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function pressHubOffset(params: PressHubParams): number {
  return (params.page - 1) * PRESS_HUB_PAGE_SIZE;
}

export function pressHubTotalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PRESS_HUB_PAGE_SIZE));
}

/** True when the requested page exceeds the filtered result set. */
export function pressHubPageOutOfRange(params: PressHubParams, total: number): boolean {
  return total > 0 && params.page > pressHubTotalPages(total);
}

/** Canonical query for the last valid page when `page` is out of range. */
export function buildPressHubClampedPageQuery(params: PressHubParams, total: number): string {
  return buildPressHubQuery({ ...params, page: pressHubTotalPages(total) });
}

/** True when URL state should not be indexed (filters or pagination). */
export function pressHubHasNonCanonicalState(params: PressHubParams): boolean {
  return Boolean(params.q) || params.year != null || params.mentionType != null || params.page > 1;
}

export function countActivePressHubFilters(params: PressHubParams): number {
  let n = 0;
  if (params.q) n += 1;
  if (params.year != null) n += 1;
  if (params.mentionType != null) n += 1;
  return n;
}

export function availablePressYears(entries: Array<{ item: { publishedAt?: string } }>): number[] {
  const years = new Set<number>();
  for (const entry of entries) {
    const publishedAt = entry.item.publishedAt;
    if (!publishedAt) continue;
    const y = Number.parseInt(publishedAt.slice(0, 4), 10);
    if (Number.isFinite(y)) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

export function buildPressActiveFilterChips(params: PressHubParams): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  if (params.q) {
    chips.push({
      key: "q",
      label: `Search: “${params.q}”`,
      removeHref: buildPressHubQuery({
        q: "",
        year: params.year,
        mentionType: params.mentionType,
        page: 1,
      }),
    });
  }
  if (params.year != null) {
    chips.push({
      key: "year",
      label: String(params.year),
      removeHref: buildPressHubQuery({
        q: params.q,
        year: null,
        mentionType: params.mentionType,
        page: 1,
      }),
    });
  }
  if (params.mentionType != null) {
    chips.push({
      key: "mentionType",
      label: getPressMentionTypeLabel(params.mentionType),
      removeHref: buildPressHubQuery({
        q: params.q,
        year: params.year,
        mentionType: null,
        page: 1,
      }),
    });
  }
  return chips;
}
