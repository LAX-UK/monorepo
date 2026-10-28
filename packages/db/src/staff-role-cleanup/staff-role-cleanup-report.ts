import { laxStaffRoleOption } from "@auction/types";
import {
  LEGACY_STAFF_ROLE_LABELS,
  STAFF_ROLE_SUCCESSORS,
  isLegacyStaffRole,
} from "./legacy-staff-roles.js";
import type { StaffRoleCleanupPlan } from "./staff-role-cleanup-plan.js";
import type {
  PendingStaffInvitation,
  RetiredOrganisationRoleUse,
} from "./staff-role-cleanup-source.js";

export type StaffRoleCleanupReportInput = {
  readonly environment: string;
  readonly generatedAt: Date;
  readonly plan: StaffRoleCleanupPlan;
  readonly invitations: readonly PendingStaffInvitation[];
  readonly organisationRoles: readonly RetiredOrganisationRoleUse[];
};

function roleLabel(role: string): string {
  if (isLegacyStaffRole(role)) return LEGACY_STAFF_ROLE_LABELS[role];
  return laxStaffRoleOption("bid", role)?.label ?? `${role} (unknown)`;
}

function roles(list: readonly string[]): string {
  return list.length > 0 ? list.map(roleLabel).join(", ") : "None";
}

function codes(list: readonly string[]): string {
  return list.length > 0 ? list.map((c) => `\`${c}\``).join(", ") : "None";
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|");
}

/** The dry-run report as Markdown, for the owner to approve before the migration runs. */
export function formatStaffRoleCleanupReport(input: StaffRoleCleanupReportInput): string {
  const { plan } = input;
  const lines: string[] = [
    "# Staff roles clean-up: dry run",
    "",
    `Environment: ${input.environment}. Read on ${input.generatedAt.toISOString()}; nothing was changed.`,
    "",
    "## Summary",
    "",
    `- Staff members: ${plan.changes.length}`,
    `- People who gain permissions: ${plan.peopleWithGains}`,
    `- People who lose permissions: ${plan.peopleWithLosses}`,
    `- Pending staff invitations: ${input.invitations.length}`,
    `- Organisation memberships or invitations still using \`specialist\` or \`staff\`: ${input.organisationRoles.length}`,
    "",
    "Retired: `content.write` only opened the read-only email log; `admin.read` opens it now, so holding `admin.read` counts as keeping it.",
    "",
    "## Staff members",
    "",
  ];
  if (plan.changes.length === 0) {
    lines.push("No staff members.", "");
  } else {
    lines.push(
      "| Person | Roles now | Roles after | Gains (needs approval) | Losses |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const change of plan.changes) {
      const person = [change.member.name, change.member.email].filter(Boolean).join(", ");
      const flag = change.gained.length > 0 ? "**Gains:** " : "";
      lines.push(
        `| ${cell(person || change.member.userId)} | ${cell(roles(change.rolesBefore))} | ${cell(
          roles(change.rolesAfter),
        )} | ${flag}${codes(change.gained)} | ${codes(change.lost)} |`,
      );
    }
    lines.push("");
  }
  const unknown = plan.changes.filter((c) => c.unknownRoles.length > 0);
  if (unknown.length > 0) {
    lines.push("## Unknown stored roles", "");
    for (const change of unknown) {
      lines.push(
        `- ${change.member.email || change.member.userId}: ${change.unknownRoles.join(", ")}`,
      );
    }
    lines.push("");
  }
  lines.push("## Organisation roles being removed", "");
  if (input.organisationRoles.length === 0) {
    lines.push("No membership or pending invitation uses `specialist` or `staff`.", "");
  } else {
    lines.push(
      "The migration stops until each of these moves to a current role (owner, admin, consignor, finance, buyer agent or viewer).",
      "",
      "| Kind | Organisation | Person | Role |",
      "| --- | --- | --- | --- |",
    );
    for (const use of input.organisationRoles) {
      lines.push(
        `| ${use.kind} | ${cell(use.organisation)} | ${cell(use.person)} | ${cell(use.role)} |`,
      );
    }
    lines.push("");
  }
  lines.push("## Pending staff invitations", "");
  if (input.invitations.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| Invited | Role now | Role on acceptance | Note |", "| --- | --- | --- | --- |");
    for (const invitation of input.invitations) {
      const successors = isLegacyStaffRole(invitation.role)
        ? STAFF_ROLE_SUCCESSORS[invitation.role]
        : [];
      const first = successors[0] ?? invitation.role;
      const note =
        successors.length > 1
          ? `An invitation carries one role: add ${roles(successors.slice(1))} after acceptance.`
          : "";
      lines.push(
        `| ${cell(invitation.email)} | ${roleLabel(invitation.role)} | ${roleLabel(first)} | ${note} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
