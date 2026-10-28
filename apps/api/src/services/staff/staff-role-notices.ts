import type { StaffNoticeRecipient } from "@auction/persistence/interfaces";
import type { LaxStaffAccessProduct } from "@auction/types";

/** The administrators of each admin, who are told about its role changes. */
export interface IStaffAdministrators {
  /** Active people holding the administrator role of `product` at `now`, each once. */
  listAdministrators(product: LaxStaffAccessProduct, now: Date): Promise<StaffNoticeRecipient[]>;
}

/** A role given or removed from the staff record, as the people involved are told it. */
export type ChangedStaffRole = {
  readonly product: LaxStaffAccessProduct;
  readonly subjectId: string;
  readonly actorSubjectId: string;
  readonly role: string;
  readonly change: "given" | "removed";
  /** When a role given with an end date ends. */
  readonly endsAt: Date | null;
  readonly reason: string;
  /** When the change was asked for; keys the notices so a retry sends nothing twice. */
  readonly requestedAt: Date;
};

/** Tells the person and the admin's administrators that a role was given or removed. */
export interface IStaffRoleChangeNotifier {
  notifyChanged(change: ChangedStaffRole, now: Date): Promise<void>;
}

/** Who hears about one person's role change: the person, then each other administrator. */
export function staffNoticeAudience(
  person: StaffNoticeRecipient | undefined,
  administrators: readonly StaffNoticeRecipient[],
): { recipient: StaffNoticeRecipient; audience: "person" | "administrator" }[] {
  return [
    ...(person ? [{ recipient: person, audience: "person" as const }] : []),
    ...administrators
      .filter((admin) => admin.id !== person?.id)
      .map((recipient) => ({ recipient, audience: "administrator" as const })),
  ];
}
