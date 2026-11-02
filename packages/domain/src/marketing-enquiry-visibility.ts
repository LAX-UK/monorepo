import { isPrivateSaleEnquiryIntent } from "./marketing-enquiry-vocabulary.js";

/** What the person looking at the enquiries may see. */
export type EnquiryViewer = {
  userId: string;
  /** May read general enquiries (contact form messages). */
  readsGeneral: boolean;
  /** May read private sale enquiries. */
  readsPrivateSale: boolean;
};

/**
 * Private sale enquiries show only to roles that read them. A general enquiry shows to roles that
 * read general enquiries, and to the person it is assigned to.
 */
export function canViewEnquiry(
  enquiry: { intent: string; assignedToUserId: string | null },
  viewer: EnquiryViewer,
): boolean {
  if (isPrivateSaleEnquiryIntent(enquiry.intent)) return viewer.readsPrivateSale;
  return viewer.readsGeneral || enquiry.assignedToUserId === viewer.userId;
}
