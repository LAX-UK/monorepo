import type { PortalEnquiry } from "@auction/shop-contracts";
import { formatPortalSaleChannel } from "./portal-sale-channel.presenter.js";
import { formatShopDate } from "./shop-date.presenter.js";

export type PortalEnquiryRowViewModel = {
  id: string;
  artworkTitle: string;
  artworkHref: string;
  channelLabel: string;
  statusLabel: string;
  /** Machine-readable timestamp for `<time dateTime>`. */
  createdAtIso: string;
  createdAtLabel: string;
};

function formatEnquiryStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function formatEnquiryDate(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? iso : formatShopDate(iso);
}

export function buildPortalEnquiryRowViewModel(
  enquiry: PortalEnquiry,
  options?: { artworkBasePath?: string },
): PortalEnquiryRowViewModel {
  const base = options?.artworkBasePath ?? "/artworks";
  return {
    id: enquiry.enquiryId,
    artworkTitle: enquiry.artworkTitle,
    artworkHref: `${base}/${enquiry.artworkSlug}`,
    channelLabel: formatPortalSaleChannel(enquiry.salesChannel),
    statusLabel: formatEnquiryStatus(enquiry.status),
    createdAtIso: enquiry.createdAt,
    createdAtLabel: formatEnquiryDate(enquiry.createdAt),
  };
}

export function buildPortalEnquiryListViewModel(
  items: PortalEnquiry[],
  options?: { artworkBasePath?: string },
): PortalEnquiryRowViewModel[] {
  return items.map((item) => buildPortalEnquiryRowViewModel(item, options));
}
