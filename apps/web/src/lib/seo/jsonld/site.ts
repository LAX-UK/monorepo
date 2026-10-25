import {
  SITE_ALTERNATE_NAMES,
  SITE_BUSINESS_ADDRESS,
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TELEPHONE_SCHEMA,
  legalEntityFor,
  localBusinessJsonLd as sharedLocalBusinessJsonLd,
  organizationJsonLd as sharedOrganizationJsonLd,
  personJsonLd as sharedPersonJsonLd,
  websiteJsonLd as sharedWebsiteJsonLd,
} from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";

export function organizationJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return sharedOrganizationJsonLd({
    name: SITE_NAME,
    legalName: legalEntityFor("bid").name,
    alternateName: SITE_ALTERNATE_NAMES,
    url: base,
    description: SITE_TAGLINE,
    logo: `${base}/logo.svg`,
    address: SITE_BUSINESS_ADDRESS,
    contactPoint: [
      {
        contactType: "customer support",
        email: SITE_CONTACT_EMAIL,
        telephone: SITE_TELEPHONE_SCHEMA,
        areaServed: "GB",
        availableLanguage: ["English"],
      },
    ],
  });
}

export function personJsonLd(opts: {
  name: string;
  url: string;
  image?: string;
  description?: string;
}) {
  return sharedPersonJsonLd(opts);
}

export function localBusinessJsonLd(): Record<string, unknown> {
  return sharedLocalBusinessJsonLd({
    name: SITE_NAME,
    legalName: legalEntityFor("bid").name,
    alternateName: SITE_ALTERNATE_NAMES,
    url: getSiteUrl(),
    description: SITE_TAGLINE,
    address: SITE_BUSINESS_ADDRESS,
    telephone: SITE_TELEPHONE_SCHEMA,
    email: SITE_CONTACT_EMAIL,
    openingHours: {
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  });
}

export function websiteJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return sharedWebsiteJsonLd({
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: base,
    description: SITE_TAGLINE,
    searchUrlTemplate: `${base}/search?q={search_term_string}`,
  });
}
