import { artworkHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { GeneralEnquiryRow, PortalEnquiry } from "@auction/shop-contracts";
import { formatShopDate } from "@auction/shop-portal/vm";

export type ArtEnquiryTone = "pending" | "success" | "neutral";

export type ArtEnquiryItemVm = {
  id: string;
  variant: "artwork" | "default";
  typeLabel: string;
  title: string;
  /** Message preview; null when the contract row has none. */
  description: string | null;
  /** Only artwork enquiries link out; general enquiries have no detail page. */
  href: string | null;
  status: { label: string; tone: ArtEnquiryTone } | null;
  createdAtIso: string;
  createdAtLabel: string;
};

const AWAITING = new Set(["open", "new", "received", "pending", "awaiting"]);
const REPLIED = new Set(["replied", "responded", "answered", "closed", "resolved"]);

/** Statuses are free text in the contract; unknown ones keep their own words on a neutral pill. */
export function mapEnquiryStatus(status: string): NonNullable<ArtEnquiryItemVm["status"]> {
  const key = status.trim().toLowerCase();
  if (AWAITING.has(key)) return { label: "Awaiting reply", tone: "pending" };
  if (REPLIED.has(key)) return { label: "Replied", tone: "success" };
  const words = key.replaceAll("_", " ");
  return { label: words.charAt(0).toUpperCase() + words.slice(1), tone: "neutral" };
}

function preview(message: string | null | undefined): string | null {
  const text = message?.trim();
  if (!text) return null;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function dateLabel(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? iso : formatShopDate(iso);
}

const TOPIC_TITLES: Record<GeneralEnquiryRow["topic"], string> = {
  general: "General enquiry",
  private_viewing: "Private viewing",
  art_advisory: "Art advisory",
  selling: "Selling a work",
  exhibition: "Exhibition enquiry",
};

export function buildArtworkEnquiryItem(row: PortalEnquiry): ArtEnquiryItemVm {
  return {
    id: row.enquiryId,
    variant: "artwork",
    typeLabel: "Artwork enquiry",
    title: row.artworkTitle,
    description: preview(row.message),
    href: artworkHref(row.artworkSlug),
    status: mapEnquiryStatus(row.status),
    createdAtIso: row.createdAt,
    createdAtLabel: dateLabel(row.createdAt),
  };
}

export function buildGeneralEnquiryItem(row: GeneralEnquiryRow): ArtEnquiryItemVm {
  return {
    id: row.enquiryId,
    variant: "default",
    typeLabel: row.topic === "private_viewing" ? "Private viewing" : "General enquiry",
    title: TOPIC_TITLES[row.topic],
    description: preview(row.message),
    href: null,
    // General enquiries carry no status in the contract, so no pill is invented.
    status: null,
    createdAtIso: row.createdAt,
    createdAtLabel: dateLabel(row.createdAt),
  };
}

function time(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

/** One list for both enquiry kinds, newest first. */
export function mergeEnquiryItems(
  artwork: readonly ArtEnquiryItemVm[],
  general: readonly ArtEnquiryItemVm[],
): ArtEnquiryItemVm[] {
  return [...artwork, ...general].sort((a, b) => time(b.createdAtIso) - time(a.createdAtIso));
}
