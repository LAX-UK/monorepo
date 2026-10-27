import { SettingsChromeLayout } from "@/components/dashboard/settings-chrome-layout";
import type { ReactNode } from "react";

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsChromeLayout spaceY={6}>{children}</SettingsChromeLayout>;
}
