export type { DashboardDensity } from "@/lib/preferences/density";
export type {
  NavEntry,
  NavGroup,
  NavItem,
  ShellConfig,
  ShellRole,
} from "./contracts";
export { SHELL_BREAKPOINTS, isNavGroup } from "./contracts";
export { buildShellConfig } from "./build-shell-config";
export type { BuildShellConfigInput } from "./build-shell-config";
export { ShellConfigProvider, useShellConfig } from "./shell-config-context";
export {
  appShellNavItemToNavItem,
  appShellNavItemsToNavItems,
  getActiveNavGroupId,
  navEntriesToFlatItems,
  navEntriesToGroups,
  staffNavGroupsToNavEntries,
} from "./nav-adapters";
