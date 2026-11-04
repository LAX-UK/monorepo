import {
  EmailDeliveryError,
  EmailDeliverySkeleton,
} from "@/components/admin/people/email-delivery/email-delivery-states";
import { EmailDeliveryView } from "@/components/admin/people/email-delivery/email-delivery-view";
import { getPersonEmailDelivery } from "@/lib/data/http/admin-email-delivery.reader";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  EMAIL_BLOCK_LIFT_ACCESS,
  EMAIL_DELIVERY_READ_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Suspense } from "react";

type Props = { userId: string; personName: string; email: string };

async function EmailDeliveryLoader({ userId, personName, email }: Props) {
  const viewer = await getServerSessionUser();
  const role = (viewer?.role ?? "client") as UserRole;
  const staff = viewer?.staffRoles;
  // No access: no panel at all, not a greyed-out box. The API refuses the read as well.
  if (!viewer || !userHasAccessTo(role, staff, EMAIL_DELIVERY_READ_ACCESS)) return null;

  const loaded = await getPersonEmailDelivery(userId);
  if (loaded.status === "no_address") return null;
  if (loaded.status === "error") return <EmailDeliveryError personName={personName} />;
  return (
    <EmailDeliveryView
      userId={userId}
      personName={personName}
      email={email}
      view={loaded.view}
      viewerCanLift={userHasAccessTo(role, staff, EMAIL_BLOCK_LIFT_ACCESS)}
    />
  );
}

/**
 * The email delivery panel on a person's page. It loads on its own, so a slow or failed read
 * never holds up the page, and it is left out for roles that may not see it.
 */
export function EmailDeliveryPanel(props: Props) {
  return (
    <Suspense fallback={<EmailDeliverySkeleton />}>
      <EmailDeliveryLoader {...props} />
    </Suspense>
  );
}
