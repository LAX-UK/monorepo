import { hopUrl } from "@/lib/navigation/hop-href";
import type { OrganisationRecoveryView } from "@/lib/organisations/organisation-recovery.vm";
import { LAX_MESSAGE_LABEL } from "@/lib/presenters/organisation-state/organisation-recovery-copy";
import type { OrganisationBannerView } from "@/lib/presenters/organisation-state/organisation-state-copy";
import { cn } from "@auction/ui";
import { ButtonLink } from "@auction/ui/lax";
import { CircleSlash, Clock, type LucideIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AccountSwitchLink } from "./account-switch-link";

type Kind = OrganisationBannerView["kind"];

/** Tone and a shape per kind, so the state never relies on colour alone. */
const KIND_STYLE: Record<Kind, { surface: string; icon: LucideIcon; iconClass: string }> = {
  info: {
    surface: "border-outline-variant/20 bg-surface-container-low",
    icon: Clock,
    iconClass: "text-on-surface-variant",
  },
  attention: {
    surface: "border-warning/50 bg-warning-container/30",
    icon: TriangleAlert,
    iconClass: "text-warning-on-surface",
  },
  blocked: {
    surface: "border-warning/50 bg-warning-container/30",
    icon: CircleSlash,
    iconClass: "text-warning-on-surface",
  },
};

/** The buttons are 44px tall on phones and the kit's control height from `sm` up. */
const BUTTON_SIZE = "h-11 sm:h-lax-control-md";

/**
 * The organisation's state as one line on Home and the Organisation page, with LAX's message when
 * it wrote one, and at most one way on plus, when the person can, a way to keep buying as
 * themselves. It is part of the page, not news, so it is not announced as an alert.
 */
export function OrganisationStateBanner({
  banner,
  personal = null,
}: {
  banner: OrganisationBannerView;
  /** From the recovery: keeps the person bidding in their own name. */
  personal?: OrganisationRecoveryView["personal"];
}) {
  const style = KIND_STYLE[banner.kind];
  const Icon = style.icon;
  const hasButtons = banner.action !== null || personal !== null;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-3 text-on-surface sm:flex-row sm:items-center sm:gap-6",
        style.surface,
      )}
      data-testid="organisation-state-banner"
      data-kind={banner.kind}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon
          className={cn("mt-0.5 size-4 shrink-0", style.iconClass)}
          strokeWidth={1.75}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="font-body text-sm">
            <strong className="font-semibold">{banner.title}</strong> {banner.line}
          </p>
          {banner.message ? (
            <p className="break-words font-body text-sm" data-testid="organisation-state-message">
              <span className="font-semibold">{LAX_MESSAGE_LABEL}:</span> {banner.message}
            </p>
          ) : null}
        </div>
      </div>
      {hasButtons ? (
        <div className="ml-7 flex shrink-0 flex-col gap-2 self-stretch sm:ml-0 sm:flex-row sm:self-center">
          {banner.action ? (
            <ButtonLink
              size="sm"
              variant="secondary"
              className={BUTTON_SIZE}
              href={banner.action.href}
              {...(banner.action.kind === "contact" ? {} : { Link })}
            >
              {banner.action.label}
            </ButtonLink>
          ) : null}
          {personal ? (
            <ButtonLink
              size="sm"
              variant="secondary"
              className={BUTTON_SIZE}
              href={hopUrl(personal.href)}
              Link={AccountSwitchLink}
            >
              {personal.label}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
