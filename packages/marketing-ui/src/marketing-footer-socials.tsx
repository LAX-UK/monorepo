import {
  type LaxOperatedProduct,
  type LaxSocialNetwork,
  socialProfilesFor,
} from "@auction/branding";
import { cn } from "@auction/ui";
import type { ReactNode, SVGProps } from "react";
import {
  MarketingInstagramIcon,
  MarketingLinkedInIcon,
  MarketingYoutubeIcon,
} from "./marketing-social-icons.js";

type MarketingSocialIconProps = SVGProps<SVGSVGElement>;

const SOCIAL_ICON: Record<LaxSocialNetwork, (props: MarketingSocialIconProps) => ReactNode> = {
  youtube: (props) => <MarketingYoutubeIcon {...props} />,
  instagram: (props) => <MarketingInstagramIcon {...props} />,
  linkedin: (props) => <MarketingLinkedInIcon {...props} />,
};

export type MarketingFooterSocialsProps = {
  /** Whose profiles to show: the product's operating company's, never another company's. */
  product: LaxOperatedProduct;
  className?: string;
  linkClassName?: string;
};

/** Footer social row with brand glyphs; renders nothing while the company has no profiles. */
export function MarketingFooterSocials({
  product,
  className,
  linkClassName,
}: MarketingFooterSocialsProps) {
  const profiles = socialProfilesFor(product);
  if (profiles.length === 0) return null;
  return (
    <div className={cn("flex flex-row items-center gap-4", className)}>
      {profiles.map(({ network, href, label }) => {
        const Icon = SOCIAL_ICON[network];
        return (
          <a
            key={network}
            href={href}
            className={linkClassName}
            aria-label={label}
            rel="noreferrer noopener"
            target="_blank"
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
