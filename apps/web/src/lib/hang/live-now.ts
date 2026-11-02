import { type HangSale, type HomeHangVM, buildHomeHang, planHomeHang } from "@/lib/hang/home-hang";
import { opensLine } from "@/lib/time/opens-line";
import { type HomeStateResult, liveTabSaleIds } from "@auction/domain";
import { HANG_MAX_WORKS } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";

export type LiveNowTab = {
  saleId: string;
  /** The sale title. */
  title: string;
  /** When the sale closes, by the time rule: "Closes Thu 12 Nov, 18:00 GMT" or "Closes in 2 days". */
  closes: string;
  hang: HomeHangVM;
};

export type LiveNowVM = {
  /** The tab open on the server: the lead sale, which is also on the cover. */
  defaultSaleId: string;
  tabs: LiveNowTab[];
  /** The calendar's Live tab, for the sales that have no tab. */
  allLive: { href: string; label: string };
};

export const ALL_LIVE_SALES_LINK = { href: "/sales?tab=live", label: "All live sales" } as const;

export function liveTabLabel(tab: Pick<LiveNowTab, "title" | "closes">): string {
  return `${tab.title} · ${tab.closes}`;
}

/**
 * The hang of one live sale, for its tab. Works the cover already shows are left out, so no
 * work appears twice. `null` when fewer than two works with photographs remain.
 */
function tabHang(
  saleId: string,
  loaded: readonly HangSale[],
  heroLotIds: ReadonlySet<string>,
  now: Date,
): HomeHangVM | null {
  const plan = planHomeHang({ state: "live", leadSaleId: saleId, resultsBandSaleIds: [] }, loaded);
  const available: Lot[] = (plan?.candidates ?? []).filter((lot) => !heroLotIds.has(lot.id));
  return buildHomeHang(plan, available.slice(0, HANG_MAX_WORKS), now);
}

/**
 * The "Live now" section for two or more live sales: one tab per sale, soonest close first, at
 * most three. `leadHang` is the lead sale's hang as the page already placed it. `null` when
 * fewer than two sales can show a hang, so the page keeps its single "In this sale" hang.
 */
export function buildLiveNow(
  state: Pick<HomeStateResult, "liveSaleIds" | "leadSaleId">,
  loaded: readonly HangSale[],
  leadHang: HomeHangVM | null,
  heroLotIds: ReadonlySet<string>,
  now: Date,
): LiveNowVM | null {
  if (state.liveSaleIds.length < 2) return null;
  const byId = new Map(loaded.map((entry) => [entry.sale.id, entry]));
  const tabs = liveTabSaleIds(state.liveSaleIds, state.leadSaleId).flatMap(
    (saleId): LiveNowTab[] => {
      const entry = byId.get(saleId);
      if (!entry) return [];
      const hang =
        saleId === state.leadSaleId ? leadHang : tabHang(saleId, loaded, heroLotIds, now);
      if (!hang) return [];
      const { label, value } = opensLine(entry.sale.endTime, now, "Closes");
      return [{ saleId, title: entry.sale.title, closes: `${label} ${value}`, hang }];
    },
  );
  const first = tabs[0];
  if (!first || tabs.length < 2) return null;
  const lead = tabs.find((tab) => tab.saleId === state.leadSaleId) ?? first;
  return { defaultSaleId: lead.saleId, tabs, allLive: ALL_LIVE_SALES_LINK };
}
