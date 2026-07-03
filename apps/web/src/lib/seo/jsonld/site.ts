import {
  SITE_ALTERNATE_NAMES,
  SITE_BUSINESS_ADDRESS,
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TELEPHONE_SCHEMA,
} from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";

export function organizationJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: base,
    description: SITE_TAGLINE,
    logo: `${base}/logo.svg`,
    address: {
      "@type": "PostalAddress",
      ...SITE_BUSINESS_ADDRESS,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE_CONTACT_EMAIL,
        telephone: SITE_TELEPHONE_SCHEMA,
        areaServed: "GB",
        availableLanguage: ["English"],
      },
    ],
  };
}

export function personJsonLd(opts: {
  name: string;
  url: string;
  image?: string;
  description?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
  };
}

export function localBusinessJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: base,
    description: SITE_TAGLINE,
    address: {
      "@type": "PostalAddress",
      ...SITE_BUSINESS_ADDRESS,
    },
    telephone: SITE_TELEPHONE_SCHEMA,
    email: SITE_CONTACT_EMAIL,
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: base,
    description: SITE_TAGLINE,
    publisher: { "@type": "Organization", name: SITE_NAME, url: base },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
