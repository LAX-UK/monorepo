/** schema.org JSON-LD builders shared by the LAX storefronts (Bid, Art). Pure; callers pass URLs. */

export type JsonLd = Record<string, unknown>;

export type PostalAddressInput = {
  streetAddress: string;
  addressLocality: string;
  addressRegion?: string;
  postalCode: string;
  addressCountry: string;
};

export type ContactPointInput = {
  contactType: string;
  email?: string;
  telephone?: string;
  areaServed?: string;
  availableLanguage?: readonly string[];
};

export type OpeningHoursInput = {
  dayOfWeek: readonly string[];
  opens: string;
  closes: string;
};

export type OrganizationJsonLdInput = {
  name: string;
  url: string;
  alternateName?: readonly string[];
  description?: string;
  logo?: string;
  address?: PostalAddressInput;
  contactPoint?: readonly ContactPointInput[];
  sameAs?: readonly string[];
};

export type LocalBusinessJsonLdInput = Omit<OrganizationJsonLdInput, "contactPoint"> & {
  /** `LocalBusiness` subtype, e.g. `ArtGallery`. */
  type?: string;
  telephone?: string;
  email?: string;
  image?: string;
  openingHours?: OpeningHoursInput;
};

export type WebsiteJsonLdInput = {
  name: string;
  url: string;
  alternateName?: readonly string[];
  description?: string;
  /** Absolute URL containing `{search_term_string}`. */
  searchUrlTemplate?: string;
};

export type BreadcrumbItemInput = { name: string; path: string };

const SCHEMA_CONTEXT = "https://schema.org";

function postalAddress(address: PostalAddressInput): JsonLd {
  return { "@type": "PostalAddress", ...address };
}

function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

/** Safe inline JSON-LD for `<script type="application/ld+json">` (escapes `<`). */
export function jsonLdScript(...items: Array<JsonLd | null | undefined>): string {
  const payload = items.filter((item): item is JsonLd => Boolean(item));
  const json =
    payload.length === 0
      ? "{}"
      : payload.length === 1
        ? JSON.stringify(payload[0])
        : JSON.stringify(payload);
  return json.replace(/</g, "\\u003c");
}

export function organizationJsonLd(input: OrganizationJsonLdInput): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name: input.name,
    ...optional("alternateName", input.alternateName),
    url: input.url,
    ...optional("description", input.description),
    ...optional("logo", input.logo),
    ...(input.address ? { address: postalAddress(input.address) } : {}),
    ...(input.contactPoint
      ? {
          contactPoint: input.contactPoint.map((point) => ({
            "@type": "ContactPoint",
            ...point,
          })),
        }
      : {}),
    ...optional("sameAs", input.sameAs),
  };
}

export function localBusinessJsonLd(input: LocalBusinessJsonLdInput): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": input.type ?? "LocalBusiness",
    name: input.name,
    ...optional("alternateName", input.alternateName),
    url: input.url,
    ...optional("description", input.description),
    ...optional("logo", input.logo),
    ...optional("image", input.image),
    ...(input.address ? { address: postalAddress(input.address) } : {}),
    ...optional("telephone", input.telephone),
    ...optional("email", input.email),
    ...(input.openingHours
      ? {
          openingHoursSpecification: {
            "@type": "OpeningHoursSpecification",
            ...input.openingHours,
          },
        }
      : {}),
    ...optional("sameAs", input.sameAs),
  };
}

export function websiteJsonLd(input: WebsiteJsonLdInput): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name: input.name,
    ...optional("alternateName", input.alternateName),
    url: input.url,
    ...optional("description", input.description),
    publisher: { "@type": "Organization", name: input.name, url: input.url },
    ...(input.searchUrlTemplate
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: input.searchUrlTemplate },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}

export function personJsonLd(input: {
  name: string;
  url: string;
  image?: string;
  description?: string;
  jobTitle?: string;
}): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Person",
    name: input.name,
    url: input.url,
    ...optional("image", input.image),
    ...optional("description", input.description),
    ...optional("jobTitle", input.jobTitle),
  };
}

/** `baseUrl` has no trailing slash; item paths are site-relative. */
export function breadcrumbJsonLd(
  baseUrl: string,
  items: readonly BreadcrumbItemInput[],
  opts?: { graphId?: string },
): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    ...(opts?.graphId ? { "@id": opts.graphId } : {}),
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${baseUrl}${item.path.startsWith("/") ? item.path : `/${item.path}`}`,
    })),
  };
}
