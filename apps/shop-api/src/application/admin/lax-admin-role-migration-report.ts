import {
  type LaxAdminRoleMigrationMember,
  type LaxAdminRoleMigrationPlan,
  planLaxAdminRoleMigration,
} from "@auction/shop-domain";
import { laxStaffRoleOption } from "@auction/types";

/** A pending invitation that gives LAX Admin roles once it is accepted. */
export type PendingLaxAdminInvitation = {
  readonly email: string;
  readonly roles: readonly string[];
};

export type LaxAdminRoleMigrationReportInput = {
  readonly environment: string;
  readonly generatedAt: Date;
  /** Members whose access is in force today. */
  readonly active: readonly LaxAdminRoleMigrationMember[];
  /** Members whose access was removed; the migration gives them no role. */
  readonly disabled: number;
  readonly invitations: readonly PendingLaxAdminInvitation[];
};

function label(role: string): string {
  return laxStaffRoleOption("shop", role)?.label ?? `${role} (unknown)`;
}

function roles(list: readonly string[]): string {
  return list.length > 0 ? list.map(label).join(", ") : "None";
}

function codes(list: readonly string[]): string {
  return list.length > 0 ? list.map((c) => `\`${c}\``).join(", ") : "None";
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|");
}

/** The plan for every active member: their roles after the migration and what they gain. */
export function planLaxAdminRoleMigrationReport(
  input: Pick<LaxAdminRoleMigrationReportInput, "active">,
): LaxAdminRoleMigrationPlan {
  return planLaxAdminRoleMigration(input.active);
}

/** The dry-run report as Markdown, for the owner to approve before the migration runs. */
export function formatLaxAdminRoleMigrationReport(input: LaxAdminRoleMigrationReportInput): string {
  const plan = planLaxAdminRoleMigrationReport(input);
  const lines: string[] = [
    "# LAX Admin roles: dry run",
    "",
    `Environment: ${input.environment}. Read on ${input.generatedAt.toISOString()}; nothing was changed.`,
    "",
    "## Summary",
    "",
    `- Active LAX Admin staff: ${plan.changes.length}`,
    `- People who gain capabilities: ${plan.peopleWithGains}`,
    `- People who lose capabilities: ${plan.peopleWithLosses}`,
    `- Staff whose access was already removed (no roles after): ${input.disabled}`,
    `- Pending invitations with LAX Admin roles: ${input.invitations.length}`,
    "",
    "Each person keeps the role they hold today as their first assignment. Catalogue editors also get Editor, which now holds the stories, exhibitions and pages work their role gave them, so their capabilities stay the same.",
    "",
    "## Staff",
    "",
  ];
  if (plan.changes.length === 0) {
    lines.push("No active LAX Admin staff.", "");
  } else {
    lines.push(
      "| Person | Role now | Roles after | Gains (needs approval) | Losses |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const change of plan.changes) {
      const person = [change.member.name, change.member.email].filter(Boolean).join(", ");
      const flag = change.gained.length > 0 ? "**Gains:** " : "";
      lines.push(
        `| ${cell(person || change.member.subjectId)} | ${cell(label(change.member.role))} | ${cell(
          roles(change.rolesAfter),
        )} | ${flag}${codes(change.gained)} | ${change.unknownRole ? "**Unknown role: the migration would stop**" : codes(change.lost)} |`,
      );
    }
    lines.push("");
  }
  lines.push("## Pending invitations", "");
  if (input.invitations.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| Invited | LAX Admin roles on acceptance |", "| --- | --- |");
    for (const invitation of input.invitations) {
      lines.push(`| ${cell(invitation.email)} | ${cell(roles(invitation.roles))} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
