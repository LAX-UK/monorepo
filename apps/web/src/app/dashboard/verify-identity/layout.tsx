import { SettingsChromeLayout } from "@/components/dashboard/settings-chrome-layout";
import type { ReactNode } from "react";

/** Identity verification uses the same settings chrome for consistent wayfinding. */
export default function VerifyIdentitySettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsChromeLayout spaceY={8}>{children}</SettingsChromeLayout>;
}
