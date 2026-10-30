import { type TeamTab, teamHref } from "./client-routes";
import {
  type SectionTabAccess,
  type SectionTabLink,
  type SectionTabSpec,
  defineSectionTabs,
} from "./section-tabs";

/**
 * The Team page's tabs, in order. Team is a top-level page for owners and admins, because who may
 * bid, pay and sell is daily work at a gallery; Members is its first tab.
 */
const TEAM_TAB_SPECS: readonly SectionTabSpec<TeamTab>[] = [
  { id: "members", label: "Members", capability: "entity.members.read" },
  { id: "invitations", label: "Invitations", capability: "entity.members.read" },
  { id: "bidding", label: "Who can bid", capability: "entity.buyer_agents.read" },
  { id: "activity", label: "Activity", capability: "entity.activity.read" },
];

const TEAM_TABS = defineSectionTabs(TEAM_TAB_SPECS, (tab) => teamHref(tab));

export type TeamTabLink = SectionTabLink<TeamTab>;
export type TeamTabAccess = SectionTabAccess<TeamTab>;

export const teamTabsFor = TEAM_TABS.tabsFor;
export const requireTeamTab = TEAM_TABS.require;
export const teamTabAt = TEAM_TABS.tabAt;
export const TEAM_PAGE_CAPABILITIES = TEAM_TABS.capabilities;
