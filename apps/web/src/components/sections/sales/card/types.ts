import type { Sale } from "@auction/types";

/** Shared fields for featured + browse row cards (ISP: narrow props derive from this). */
export type SaleCardCommon = {
  id: string;
  href: string;
  title: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  status: Sale["status"];
  countdownEndIso?: string;
  deliveryMode?: Sale["deliveryMode"];
};

/** OCP: extend actions without changing `SaleCardActions` layout. */
export type SaleActionVariant = "cta" | "outline" | "ghost";

export type SaleAction = {
  id: string;
  label: string;
  href: string;
  variant: SaleActionVariant;
  ariaLabel?: string;
};

export type SaleCardMediaLinkMode = "area" | "none";

export type SaleCardMediaProps = Pick<
  SaleCardCommon,
  "href" | "coverImageUrl" | "coverImageAlt"
> & {
  countdownEndIso?: string;
  /** When true, show live pill + countdown (caller derives from status + countdown). */
  isLive: boolean;
  sizes?: string;
  className?: string;
  /** `area`: image is wrapped in a link to `href`. `none`: parent handles navigation (e.g. whole-card link). */
  linkMode?: SaleCardMediaLinkMode;
  /** Image container rounding (featured uses rounded; row uses rounded-md). */
  imageRoundedClassName?: string;
  /** Optional scrim over image (`bg-black/10` row, `bg-black/20` featured). */
  scrimClassName?: string;
  /** Row cards use fixed desktop height; featured uses fluid aspect. */
  layout?: "calendarRow" | "featured";
};

export type SaleCardTitleProps =
  | {
      href: string;
      title: string;
      className?: string;
    }
  | {
      mode: "embedded";
      title: string;
      className?: string;
    };
