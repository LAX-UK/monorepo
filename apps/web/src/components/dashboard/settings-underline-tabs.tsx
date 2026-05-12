import { UnderlineTabs } from "@/components/ui/underline-tabs";

export type SettingsMainTab = "profile" | "security";

const TABS = [
  { id: "profile" as const, label: "My profile", href: "/dashboard/settings" },
  { id: "security" as const, label: "Account security", href: "/dashboard/settings?tab=security" },
];

type SettingsUnderlineTabsProps = {
  active: SettingsMainTab;
  className?: string;
};

/** Thin settings-scoped wrapper around the shared {@link UnderlineTabs} primitive. */
export function SettingsUnderlineTabs({ active, className }: SettingsUnderlineTabsProps) {
  return (
    <UnderlineTabs<SettingsMainTab>
      ariaLabel="Settings sections"
      active={active}
      tabs={TABS}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
