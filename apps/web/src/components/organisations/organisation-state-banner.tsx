import type { OrganisationBannerView } from "@/lib/presenters/organisation-state/organisation-state-copy";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { CircleSlash, Clock, type LucideIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";

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

/**
 * The organisation's state as one line on Home and the Organisation page, with at most one way
 * on. It is part of the page, not news, so it is not announced as an alert.
 */
export function OrganisationStateBanner({ banner }: { banner: OrganisationBannerView }) {
  const style = KIND_STYLE[banner.kind];
  const Icon = style.icon;
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
        <p className="font-body text-sm">
          <strong className="font-semibold">{banner.title}</strong> {banner.line}
        </p>
      </div>
      {banner.action ? (
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="ml-7 shrink-0 self-start sm:ml-0 sm:self-center"
        >
          {banner.action.kind === "contact" ? (
            <a href={banner.action.href}>{banner.action.label}</a>
          ) : (
            <Link href={banner.action.href}>{banner.action.label}</Link>
          )}
        </Button>
      ) : null}
    </div>
  );
}
