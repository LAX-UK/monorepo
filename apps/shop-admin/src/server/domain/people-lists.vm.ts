import {
  ADMIN_AUDIT_FILTER_MAX_LENGTH,
  ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
} from "@auction/shop-contracts";
import type { TeamView } from "@auction/staff-ui";
import { STAFF_ROLES, type StaffRoleValue } from "./staff-directory.vm";
import { defineWorkList } from "./work-list.vm";

/*
 * The people lists in LAX Admin: clients, staff and the audit log. Each one's views, filters,
 * sorts and the param that opens a record in its panel; the first sort key is the API's default.
 */

export const clientsList = defineWorkList({
  path: "/clients",
  views: [
    { id: "all", label: "All", api: {} },
    { id: "person", label: "People", api: { kind: "person" }, statuses: ["person"] },
    { id: "gallery", label: "Galleries", api: { kind: "gallery" }, statuses: ["gallery"] },
  ],
  defaultView: "all",
  filters: {},
  sorts: {
    joined: { asc: "joined_asc", desc: "joined_desc" },
    name: { asc: "name_asc", desc: "name_desc" },
  },
  defaultSort: "joined_desc",
  panelParam: "client",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

export const staffList = defineWorkList({
  path: "/staff",
  views: [
    { id: "all", label: "All", api: {} },
    { id: "active", label: "Active", api: { status: "active" }, statuses: ["active"] },
    {
      id: "disabled",
      label: "Access removed",
      api: { status: "disabled" },
      statuses: ["disabled"],
    },
  ],
  defaultView: "all",
  filters: { role: { anyOf: STAFF_ROLES } },
  sorts: {
    name: { asc: "name_asc", desc: "name_desc" },
    added: { asc: "added_asc", desc: "added_desc" },
  },
  defaultSort: "name_asc",
  panelParam: "staff",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

const TEAMS: ReadonlyArray<{ id: string; label: string; roles: readonly StaffRoleValue[] }> = [
  { id: "admins", label: "Administrators", roles: ["shop_admin"] },
  { id: "sales", label: "Sales team", roles: ["account_manager", "broker"] },
  {
    id: "operations",
    label: "Operations, catalogue and editorial",
    roles: ["operations", "catalogue_editor", "editor"],
  },
  { id: "finance", label: "Finance", roles: ["finance"] },
];

/** Views of the staff list everyone sees, a team at a time. Fixed here, never edited. */
export function staffTeamViews(): TeamView[] {
  const state = staffList.parse({});
  return TEAMS.map(({ id, label, roles }) => {
    const href = staffList.href(state, { role: roles.join(",") });
    return { id: `team-${id}`, label, href, query: href.split("?")[1] ?? "" };
  });
}

const auditText = { text: ADMIN_AUDIT_FILTER_MAX_LENGTH };

export const auditList = defineWorkList({
  path: "/audit",
  views: [{ id: "all", label: "All", api: {} }],
  defaultView: "all",
  filters: {
    actor: auditText,
    action: auditText,
    targetType: auditText,
    targetId: auditText,
    from: "day",
    to: "day",
  },
  sorts: { when: { asc: "at_asc", desc: "at_desc" } },
  defaultSort: "at_desc",
  panelParam: "event",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});
