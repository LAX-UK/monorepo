import Link from "next/link";
import { LegalDocument, LegalSection } from "./legal-document.js";
import { LegalHub, type LegalHubLink } from "./legal-hub.js";
import {
  LAX_ART_LEGAL_INDEX,
  LAX_ART_POLICIES,
  type LaxArtPolicySlug,
} from "./london-art-exchange/index.js";
import { formatLegalPolicyDate } from "./policy/legal-policy-page.js";

export type LegalPolicyIndexProps = {
  /** Where each policy lives on this product. */
  hrefFor: (slug: LaxArtPolicySlug) => string;
  /** False for a policy this deployment may not link to, such as a draft on production. */
  isListed?: (slug: LaxArtPolicySlug) => boolean;
  hubLabel: string;
  hubLinks: readonly LegalHubLink[];
};

function anchorFor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** London Art Exchange Ltd's legal index: every policy, grouped as the business team set them. */
export function LegalPolicyIndex({
  hrefFor,
  isListed = () => true,
  hubLabel,
  hubLinks,
}: LegalPolicyIndexProps) {
  return (
    <LegalHub label={hubLabel} links={hubLinks}>
      <LegalDocument title={LAX_ART_LEGAL_INDEX.title} lead={LAX_ART_LEGAL_INDEX.intro}>
        {LAX_ART_LEGAL_INDEX.groups.map((group) => (
          <LegalSection key={group.title} id={anchorFor(group.title)} heading={group.title}>
            <ul className="lax-legal__index">
              {group.slugs.filter(isListed).map((slug) => {
                const policy = LAX_ART_POLICIES[slug];
                return (
                  <li key={slug}>
                    <Link href={hrefFor(slug)} className="lax-legal__index-link">
                      <span className="lax-legal__index-label">{policy.label}</span>
                      <span className="lax-legal__index-description">{policy.description}</span>
                      <span className="lax-legal__index-meta">
                        v{policy.release.version} ·{" "}
                        {formatLegalPolicyDate(policy.release.lastUpdated)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </LegalSection>
        ))}
      </LegalDocument>
    </LegalHub>
  );
}
