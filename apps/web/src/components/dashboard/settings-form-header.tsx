import {
  DashboardPageHeader,
  type DashboardPageHeaderProps,
} from "@/components/dashboard/primitives/dashboard-page-header";
import type { AccentTrack } from "@/lib/dashboard/accent-track";

export type SettingsFormHeaderProps = Omit<DashboardPageHeaderProps, "meta"> & {
  eyebrow?: string;
  track?: AccentTrack;
};

/** Settings sub-pages — eyebrow + title; mobile shell owns visible title below lg. */
export function SettingsFormHeader({
  title,
  eyebrow = "Settings",
  hideTitleOnMobile = true,
  hideDescriptionOnMobile = true,
  hideMetaOnMobile = true,
  ...props
}: SettingsFormHeaderProps) {
  return (
    <DashboardPageHeader
      meta={eyebrow}
      title={title}
      hideTitleOnMobile={hideTitleOnMobile}
      hideDescriptionOnMobile={hideDescriptionOnMobile}
      hideMetaOnMobile={hideMetaOnMobile}
      {...props}
    />
  );
}
