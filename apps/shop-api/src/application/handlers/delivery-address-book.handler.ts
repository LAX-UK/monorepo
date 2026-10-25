import type { SavedDeliveryAddressList } from "@auction/shop-contracts";
import type {
  DeliveryAddressBook,
  DeliveryAddressToSave,
} from "../ports/delivery-address-book.port.js";

type ReportFailure = (error: unknown) => void;

const sameText = (a: string | null, b: string | null) =>
  (a ?? "").trim().replace(/\s+/g, " ").toLowerCase() ===
  (b ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The book keeps phone numbers in E.164. A UK national number ("07700 900123") is converted;
 * anything else that is not already E.164 is left out rather than saved in a form it refuses.
 */
export function deliveryPhoneToE164(phone: string | null): string | null {
  // "+44 (0)20 …" is a common way to write a UK number; the trunk 0 is not dialled after +44.
  const compact = (phone ?? "")
    .replace(/\(0\)/g, "")
    .replace(/[\s()-]/g, "")
    .replace(/^\+440/, "+44");
  if (/^\+[1-9]\d{6,14}$/.test(compact)) return compact;
  if (/^0\d{9,10}$/.test(compact)) return `+44${compact.slice(1)}`;
  return null;
}

/**
 * Saved addresses for checkout, default first. A book that cannot be read answers as
 * unavailable rather than failing, so the shopper can still type an address.
 */
export function createListSavedDeliveryAddressesHandler(book: DeliveryAddressBook | null) {
  return async (subject: string, report: ReportFailure): Promise<SavedDeliveryAddressList> => {
    if (!book) return { available: false, addresses: [] };
    try {
      const addresses = await book.list(subject);
      return {
        available: true,
        addresses: [...addresses].sort(
          (a, b) => Number(b.isDefaultShipping) - Number(a.isDefaultShipping),
        ),
      };
    } catch (error) {
      report(error);
      return { available: false, addresses: [] };
    }
  };
}

/**
 * Adds a delivery address to the person's book when they ask for it at checkout. It is skipped
 * when the book already holds the same address (a retried checkout must not save it twice),
 * and a failure never stops the order: it is reported and the shopper carries on to payment.
 */
export function createSaveDeliveryAddressHandler(book: DeliveryAddressBook | null) {
  return async (
    subject: string,
    address: Omit<DeliveryAddressToSave, "label">,
    report: ReportFailure,
  ): Promise<"saved" | "already_saved" | "failed"> => {
    if (!book) return "failed";
    try {
      const existing = await book.list(subject);
      const duplicate = existing.some(
        (saved) =>
          sameText(saved.recipientName, address.recipientName) &&
          sameText(saved.line1, address.line1) &&
          sameText(saved.line2, address.line2) &&
          sameText(saved.city, address.city) &&
          sameText(saved.postcode, address.postcode) &&
          saved.country === address.country,
      );
      if (duplicate) return "already_saved";
      await book.add(subject, {
        ...address,
        phone: deliveryPhoneToE164(address.phone),
        label: address.line1.trim().slice(0, 80),
      });
      return "saved";
    } catch (error) {
      report(error);
      return "failed";
    }
  };
}
