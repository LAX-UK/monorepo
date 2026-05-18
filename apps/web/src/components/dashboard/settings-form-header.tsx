import {
  DashboardPageHeader,
  type DashboardPageHeaderProps,
} from "@/components/dashboard/primitives/dashboard-page-header";
import type { AccentTrack } from "@/lib/dashboard/accent-track";

export type SettingsFormHeaderProps = Omit<DashboardPageHeaderProps, "meta"> & {
  eyebrow?: string;
  track?: AccentTrack;
};

/** Settings sub-pages — eyebrow + title; optional description and actions. */
export function SettingsFormHeader({
  title,
  eyebrow = "Settings",
  ...props
}: SettingsFormHeaderProps) {
  return <DashboardPageHeader meta={eyebrow} title={title} {...props} />;
}
