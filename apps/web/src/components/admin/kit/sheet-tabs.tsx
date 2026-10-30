"use client";

import {
  PlainLink,
  SecondaryTabNav,
  SegmentedControl,
  TabNav,
  type TabNavItem,
} from "@auction/ui/lax";
import { useState } from "react";
import { SheetSection, StateRow } from "./sheet-frame";

const TEAM_TABS: readonly TabNavItem[] = [
  { id: "members", label: "Members", href: "#members", count: 14 },
  {
    id: "invitations",
    label: "Invitations",
    href: "#invitations",
    count: 2,
    countTone: "attention",
  },
  { id: "bidding", label: "Who can bid", href: "#bidding" },
  { id: "activity", label: "Activity", href: "#activity" },
];

const SUB_TABS: readonly TabNavItem[] = [
  { id: "registrations", label: "Registrations", href: "#registrations", count: 8 },
  { id: "phones", label: "Telephone bookings", href: "#phones" },
];

type Theme = "light" | "dark" | "system";

export function SheetTabs() {
  const [theme, setTheme] = useState<Theme>("light");
  return (
    <SheetSection
      id="tabs"
      title="Tabs and segmented control"
      description="Underline tabs, each a real URL, with muted counts (ink when the count is work waiting). Tabs that do not fit go into More, and the current one always stays. Segmented control: two to four exclusive views, the chosen one raised."
    >
      {() => (
        <>
          <StateRow label="Page tabs">
            <TabNav
              items={TEAM_TABS}
              activeId="members"
              label="Team"
              Link={PlainLink}
              className="w-full"
            />
          </StateRow>
          <StateRow label="Narrow">
            <div className="w-64">
              <TabNav items={TEAM_TABS} activeId="activity" label="Team, narrow" Link={PlainLink} />
            </div>
          </StateRow>
          <StateRow label="Second level">
            <SecondaryTabNav
              items={SUB_TABS}
              activeId="registrations"
              label="Bidders"
              Link={PlainLink}
            />
          </StateRow>
          <StateRow label="Segmented">
            <SegmentedControl<Theme>
              value={theme}
              onValueChange={setTheme}
              label="Appearance"
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "Match device" },
              ]}
            />
          </StateRow>
        </>
      )}
    </SheetSection>
  );
}
