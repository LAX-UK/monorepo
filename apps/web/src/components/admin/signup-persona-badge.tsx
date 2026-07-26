"use client";

import {
  type SignupPersonaIconKey,
  type SignupPersonaPaletteKey,
  resolveSignupPersonaPresentation,
} from "@/lib/presenters/signup-persona/signup-persona-registry";
import { cn } from "@auction/ui";
import { Building2, CircleHelp, type LucideIcon, UserRound } from "lucide-react";

type Props = {
  persona: string | null | undefined;
  className?: string;
  /** When set, overrides resolved palette (tests/storybook). */
  paletteKey?: SignupPersonaPaletteKey;
  /** When set, overrides resolved label. */
  label?: string;
  /** When set, overrides resolved icon (tests/storybook). */
  iconKey?: SignupPersonaIconKey;
  /** Compact sizing for table cells and meta rows. */
  size?: "default" | "compact";
};

const ICON_BY_KEY: Record<SignupPersonaIconKey, LucideIcon> = {
  user: UserRound,
  building: Building2,
  help: CircleHelp,
};

const BADGE_BASE =
  "inline-flex w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-full font-label font-semibold leading-[18px]";

const SIZE_CLASSES = {
  default: "gap-1 px-2.5 py-0.5 text-xs",
  compact: "gap-0.5 px-2 py-0.5 text-[10px]",
} as const;

const ICON_SIZE = {
  default: "size-3",
  compact: "size-2.5",
} as const;

/** Tag-style signup persona pill with categorical color and semantic icon. */
export function SignupPersonaBadge({
  persona,
  className,
  paletteKey: paletteKeyOverride,
  label: labelOverride,
  iconKey: iconKeyOverride,
  size = "default",
}: Props) {
  const presentation = resolveSignupPersonaPresentation(persona);
  const paletteKey = paletteKeyOverride ?? presentation.paletteKey;
  const visibleLabel = labelOverride ?? presentation.label;
  const iconKey = iconKeyOverride ?? presentation.iconKey;
  const Icon = ICON_BY_KEY[iconKey];

  return (
    <span
      className={cn(BADGE_BASE, "signup-persona-badge", SIZE_CLASSES[size], className)}
      data-signup-persona={paletteKey}
      aria-label={presentation.ariaLabel}
      title={presentation.ariaLabel}
    >
      <Icon className={cn(ICON_SIZE[size], "shrink-0")} aria-hidden />
      {visibleLabel}
    </span>
  );
}
