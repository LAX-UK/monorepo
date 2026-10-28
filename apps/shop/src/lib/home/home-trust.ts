import { SHOP_POLICY_PATHS, type ShopPolicySlug } from "@/content/policies/shop-policy-status";
import { type CheckoutDeliveryTimes, workingDaysLabel } from "@/lib/checkout/checkout-delivery";
import { GALLERY_CONTACT } from "@auction/branding";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/*
 * The trust strip under the first screen: the three questions that stop a first purchase
 * (delivery, collection, changing your mind) and a person to ask. Every line comes from what
 * checkout and the gallery's contact details already keep; the strip makes no claim about
 * signing or numbering, which each edition states for itself.
 */

export type HomeTrustColumnVm = {
  id: "delivery" | "collection" | "returns" | "help";
  title: string;
  line: string;
  /** The phone number is a link to call; the other lines are plain. */
  href: string | null;
};

export type HomeTrustVm = {
  columns: HomeTrustColumnVm[];
  /** The one line phones show in place of the columns. */
  phone: { text: string; link: { label: string; href: string } };
};

function price(pence: number): string {
  return formatGbpPenceForDisplay(pence);
}

function policyHref(linkable: readonly ShopPolicySlug[], slug: ShopPolicySlug): string | null {
  return linkable.includes(slug) ? SHOP_POLICY_PATHS[slug] : null;
}

export function buildHomeTrust(input: {
  deliveryTimes: CheckoutDeliveryTimes;
  linkablePolicies: readonly ShopPolicySlug[];
}): HomeTrustVm {
  const delivery = price(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery);
  const collectionPence = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish;
  const freeCollection = collectionPence === 0;
  const { ukDelivery, collection } = input.deliveryTimes;
  const from = `From ${GALLERY_CONTACT.streetLine}`;
  return {
    columns: [
      {
        id: "delivery",
        title: `Insured UK delivery, ${delivery}`,
        line: ukDelivery ? workingDaysLabel(ukDelivery) : "Tracked and insured to your door",
        href: null,
      },
      {
        id: "collection",
        title: freeCollection ? "Free collection" : `Collection, ${price(collectionPence)}`,
        line: collection ? `${from}, ready in ${workingDaysLabel(collection)}` : from,
        href: null,
      },
      {
        id: "returns",
        title: "14-day cancellation",
        line: "Change your mind after delivery",
        href: null,
      },
      {
        id: "help",
        title: "Help from the gallery",
        line: GALLERY_CONTACT.phone,
        href: GALLERY_CONTACT.phoneHref,
      },
    ],
    phone: {
      text: `${delivery} insured, or ${freeCollection ? "free " : ""}collection`,
      link: {
        label: "Delivery and returns",
        href:
          policyHref(input.linkablePolicies, "delivery") ??
          policyHref(input.linkablePolicies, "returns") ??
          SHOP_POLICY_PATHS.help,
      },
    },
  };
}
