import type { EnquirySender } from "../enquiry-sender.js";
import type { GeneralEnquiryTopic } from "./editorial.repository.js";
import type { ShopNotificationTx } from "./shop-notification.publisher.js";

/** An enquiry just stored, as the steps that follow it need it. */
export type StoredEnquiry = {
  /** "E-2041". */
  reference: string;
  sender: EnquirySender;
  phone: string | null;
  salesChannel: "shop" | "art";
} & (
  | { topic: "artwork"; artworkTitle: string; artworkUrl: string }
  | { topic: GeneralEnquiryTopic }
);

/**
 * What happens once an enquiry is stored, in the same transaction: a guest becomes (or stays) a
 * lead, and the sender gets their copy with the reference. Kept apart from the writers so the
 * artwork and the general enquiry follow the same steps.
 */
export interface EnquiryFollowUp {
  afterStored(tx: ShopNotificationTx, enquiry: StoredEnquiry, now: Date): Promise<void>;
}
