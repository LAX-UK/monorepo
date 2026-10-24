import { getLaxAccountContainer } from "../container";
import { type ArtistPageVm, buildArtistPage } from "../domain/selling/selling-artworks.vm";
import { type EditionsPageVm, buildEditionsPage } from "../domain/selling/selling-editions.vm";
import {
  type PayoutAccountVm,
  type PayoutsListVm,
  buildPayoutAccount,
  buildPayoutsList,
} from "../domain/selling/selling-payouts.vm";
import {
  type SalesPageVm,
  type SalesPeriod,
  buildSalesPage,
} from "../domain/selling/selling-sales.vm";
import type { SessionHandle } from "../ports/portfolio-gateway";
import type { SellingRead } from "../ports/selling-gateway";

/** A section's view, or that Shop could not answer for it. */
export type SectionLoad<T> = { status: "ok"; view: T } | { status: "unavailable" };

/** Switched off reads as empty: there is nothing to sell, rather than something broken. */
function rowsOf<T>(read: SellingRead<T[]>): T[] | null {
  if (read.status === "ok") return read.data;
  return read.status === "off" ? [] : null;
}

export async function loadEditionsSection(
  handle: SessionHandle,
): Promise<SectionLoad<EditionsPageVm>> {
  const { selling } = getLaxAccountContainer();
  const [editions, requests] = await Promise.all([
    selling.readEditions(handle),
    selling.readRequests(handle),
  ]);
  const editionRows = rowsOf(editions);
  const requestRows = rowsOf(requests);
  if (!editionRows || !requestRows) return { status: "unavailable" };
  return { status: "ok", view: buildEditionsPage(editionRows, requestRows) };
}

export async function loadSalesSection(
  handle: SessionHandle,
  period: SalesPeriod,
  nowMs = Date.now(),
): Promise<SectionLoad<SalesPageVm>> {
  const { selling } = getLaxAccountContainer();
  const [sales, payouts] = await Promise.all([
    selling.readSales(handle),
    selling.readPayouts(handle),
  ]);
  const saleRows = rowsOf(sales);
  if (!saleRows) return { status: "unavailable" };
  // Without payouts each sale still shows its payout state, only undated.
  return { status: "ok", view: buildSalesPage(saleRows, rowsOf(payouts) ?? [], period, nowMs) };
}

export async function loadPayoutAccountSection(
  handle: SessionHandle,
): Promise<SectionLoad<PayoutAccountVm>> {
  const read = await getLaxAccountContainer().selling.readPayoutAccount(handle);
  return read.status === "ok"
    ? { status: "ok", view: buildPayoutAccount(read.data) }
    : { status: "unavailable" };
}

export async function loadPayoutsSection(
  handle: SessionHandle,
): Promise<SectionLoad<PayoutsListVm>> {
  const rows = rowsOf(await getLaxAccountContainer().selling.readPayouts(handle));
  return rows ? { status: "ok", view: buildPayoutsList(rows) } : { status: "unavailable" };
}

export async function loadArtistSection(handle: SessionHandle): Promise<SectionLoad<ArtistPageVm>> {
  const { selling } = getLaxAccountContainer();
  const [artworks, sales] = await Promise.all([
    selling.readArtistArtworks(handle),
    selling.readArtistSales(handle),
  ]);
  if (artworks.status === "unavailable" || sales.status === "unavailable") {
    return { status: "unavailable" };
  }
  return {
    status: "ok",
    view: buildArtistPage(
      artworks.status === "ok" ? artworks.data : null,
      sales.status === "ok" ? sales.data : null,
    ),
  };
}
