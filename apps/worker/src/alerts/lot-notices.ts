import type { DigestGroup, DigestVm } from "@auction/alerts";

export type LotNoticeType = "artist_lots_listed" | "search_lots_listed";

/** One in-app notice: what the person reads, and the site page it opens. */
export type LotNotice = {
  type: LotNoticeType;
  title: string;
  message: string;
  linkPath: string;
};

/** Where a notice about several artists or searches opens: the person's own Watching page. */
const WATCHING_PATH = "/watching";

const TOPIC_NOTICE: Readonly<Record<string, LotNoticeType>> = {
  "bid.artists": "artist_lots_listed",
  "bid.searches": "search_lots_listed",
};

const quoted = (text: string) => `“${text}”`;
const lots = (count: number) => (count === 1 ? "New lot" : `${count} new lots`);

function names(labels: readonly string[]): string {
  const shown = labels.slice(0, 2);
  const rest = labels.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  return shown.join(" and ");
}

/**
 * Wording for one topic of a digest. One lot opens the lot; several from one artist or search
 * open that artist's page or those results; several from more than one open Watching.
 */
function noticeFor(type: LotNoticeType, group: DigestGroup): LotNotice | null {
  const subgroups = group.subgroups.filter((s) => s.items.length > 0);
  const first = subgroups[0]?.items[0];
  if (!first) return null;
  const artist = type === "artist_lots_listed";
  const single = group.total === 1;
  const oneSource = subgroups.length === 1 && !group.truncated;
  const label = subgroups[0]?.label;

  if (single) {
    const detail = [first.title, first.subtitle].filter(Boolean).join(" · ");
    return {
      type,
      title: artist
        ? `New lot by ${label ?? "an artist you follow"}`
        : `New lot matching ${label ? quoted(label) : "your saved search"}`,
      message: detail,
      linkPath: first.path,
    };
  }
  if (oneSource && label) {
    return {
      type,
      title: artist
        ? `${lots(group.total)} by ${label}`
        : `${lots(group.total)} matching ${quoted(label)}`,
      message: `Including ${first.title}`,
      linkPath: subgroups[0]?.path ?? WATCHING_PATH,
    };
  }
  const labels = subgroups.map((s) => s.label).filter((l): l is string => Boolean(l));
  return {
    type,
    title: artist
      ? `${lots(group.total)} by artists you follow`
      : `${lots(group.total)} matching your saved searches`,
    message: labels.length > 0 ? `From ${names(labels)}` : `Including ${first.title}`,
    linkPath: WATCHING_PATH,
  };
}

/**
 * The in-app notices for one digest: at most one per topic, however many lots matched that day.
 * The new-sale topic has its own notice, written when the sale is announced, so it is skipped.
 */
export function lotNoticesOf(vm: DigestVm): LotNotice[] {
  const out: LotNotice[] = [];
  for (const group of vm.groups) {
    const type = TOPIC_NOTICE[group.topic];
    if (!type) continue;
    const notice = noticeFor(type, group);
    if (notice) out.push(notice);
  }
  return out;
}
