import type { EnquiryView } from "@auction/domain";
import {
  ENQUIRIES_ACCESS,
  ENQUIRY_ASSIGN_ACCESS,
  ENQUIRY_ROUTING_MANAGE_ACCESS,
  MARKETING_ENQUIRIES_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

/** What the signed-in person may do on the Enquiries screens, from their capabilities. */
export type EnquiryAbilities = {
  /** Change status, close, add notes and hand an enquiry over. Without it the screens are view only. */
  canWork: boolean;
  /** Choose which specialist receives each department's enquiries. */
  canRoute: boolean;
  /** The view this person lands on. */
  defaultView: EnquiryView;
};

type Holder = { role: UserRole; staffRoles: StaffRoles | undefined };

/**
 * One rule for the whole screen: whoever may hand an enquiry over may work it; the API enforces
 * the same sets. A specialist (who holds private sale work but does not triage) lands on their own
 * queue; everyone else on everything open.
 */
export function enquiryAbilities({ role, staffRoles }: Holder): EnquiryAbilities {
  const can = (requirement: Parameters<typeof userHasAccessTo>[2]) =>
    userHasAccessTo(role, staffRoles, requirement);
  const triages = can(MARKETING_ENQUIRIES_ACCESS) || can(ENQUIRY_ROUTING_MANAGE_ACCESS);
  const reads = can(ENQUIRIES_ACCESS);
  return {
    canWork: can(ENQUIRY_ASSIGN_ACCESS),
    canRoute: can(ENQUIRY_ROUTING_MANAGE_ACCESS),
    defaultView: reads && !triages ? "assigned_to_me" : "open",
  };
}

/** The statuses a person may move an enquiry to by hand, and what each is called on the button. */
export const STATUS_MOVE_LABELS = {
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
} as const;
