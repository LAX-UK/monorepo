import { LAX_SOCIAL_ARIA_LABELS, LAX_SOCIAL_LINKS, type LaxSocialNetwork } from "@auction/branding";
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

const DEFAULT_ORDER: LaxSocialNetwork[] = ["youtube", "instagram", "linkedin"];

export type MarketingFooterSocialsProps = {
  className?: string;
  linkClassName?: string;
  networks?: readonly LaxSocialNetwork[];
};

/** Footer social row — shared LAX destinations and brand glyphs from marketing-ui. */
export function MarketingFooterSocials({
  className,
  linkClassName,
  networks = DEFAULT_ORDER,
}: MarketingFooterSocialsProps) {
  return (
    <div className={cn("flex flex-row items-center gap-4", className)}>
      {networks.map((network) => {
        const Icon = SOCIAL_ICON[network];
        return (
          <a
            key={network}
            href={LAX_SOCIAL_LINKS[network]}
            className={linkClassName}
            aria-label={LAX_SOCIAL_ARIA_LABELS[network]}
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
