import { organisationRoleGroupsSentence } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  rolesWithCapability,
} from "@auction/domain";

/** One tab of a workspace page (Organisation, Team) and what a member needs to open it. */
export type SectionTabSpec<Id extends string> = {
  id: Id;
  label: string;
  capability: EntityCapability;
  /**
   * Another capability that opens the tab for a part of it (finance opens Profile for the
   * invoice details); the page shows each part only to those who hold it.
   */
  alsoOpenedBy?: EntityCapability;
};

/** Every capability that opens a tab. */
export function tabCapabilities(spec: SectionTabSpec<string>): EntityCapability[] {
  return spec.alsoOpenedBy ? [spec.capability, spec.alsoOpenedBy] : [spec.capability];
}

function opens(actor: EntityActor, spec: SectionTabSpec<string>): boolean {
  return tabCapabilities(spec).some((capability) => entityActorCan(actor, capability));
}

export type SectionTabLink<Id extends string> = { id: Id; label: string; href: string };

export type SectionTabAccess<Id extends string> =
  | { kind: "open" }
  | {
      kind: "forbidden";
      /** The tab's name, for "You don't have access to Members". */
      label: string;
      /** Who can open it, for "Owners and admins can open it". */
      openedBy: string;
      /** What opens it, so the person can ask for a role that has it. */
      capability: EntityCapability;
      /** The first tab the person can open, if any, to send them on to. */
      fallback: SectionTabLink<Id> | null;
    };

export type SectionTabs<Id extends string> = {
  /** The tabs `actor` may open, in page order. */
  tabsFor(actor: EntityActor): SectionTabLink<Id>[];
  /**
   * Whether `actor` may open `tab`. Every tab page asks this before loading anything, so a tab
   * that is not listed for someone cannot be opened by its address either.
   */
  require(actor: EntityActor, tab: Id): SectionTabAccess<Id>;
  /** The tab at `pathname` and what opens it, or `null` for a page that is not a tab. */
  tabAt(pathname: string): SectionTabSpec<Id> | null;
  /** Every capability that opens at least one tab; the menu shows the page to these members. */
  capabilities: readonly EntityCapability[];
};

/**
 * A workspace page's tabs as one table, read by its layout, every tab page, the menu and the
 * tests. Adding a tab or moving who opens it is one row in the table. Reading capabilities let
 * support staff viewing as the client open what the client sees; the actions inside each tab ask
 * for their own write capability.
 */
export function defineSectionTabs<Id extends string>(
  specs: readonly SectionTabSpec<Id>[],
  hrefFor: (tab: Id) => string,
): SectionTabs<Id> {
  const tabsFor = (actor: EntityActor) =>
    specs
      .filter((spec) => opens(actor, spec))
      .map((spec) => ({ id: spec.id, label: spec.label, href: hrefFor(spec.id) }));
  return {
    tabsFor,
    require(actor, tab) {
      const spec = specs.find((s) => s.id === tab);
      if (!spec) throw new Error(`Unknown tab: ${tab}`);
      if (opens(actor, spec)) return { kind: "open" };
      return {
        kind: "forbidden",
        label: spec.label,
        openedBy: organisationRoleGroupsSentence([
          ...new Set(tabCapabilities(spec).flatMap((capability) => rolesWithCapability(capability))),
        ]),
        capability: spec.capability,
        fallback: tabsFor(actor)[0] ?? null,
      };
    },
    tabAt(pathname) {
      return specs.find((s) => hrefFor(s.id) === pathname) ?? null;
    },
    capabilities: [...new Set(specs.flatMap((spec) => tabCapabilities(spec)))],
  };
}
