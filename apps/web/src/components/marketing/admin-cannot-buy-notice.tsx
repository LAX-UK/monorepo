import { PolicyNotice } from "@/components/marketing/policy-notice";
import type { SessionUser } from "@/lib/data/contracts";
import { isAdminBuyerBlocked } from "@/lib/presenters/viewer-participation";
import { ADMIN_CANNOT_BUY_DESCRIPTION, ADMIN_CANNOT_BUY_TITLE } from "@/lib/ui/admin-cannot-buy";
import type { ReactNode } from "react";

export { isAdminBuyerBlocked };

export function AdminCannotBuyNotice({ className }: { className?: string }) {
  return (
    <PolicyNotice
      variant="primary"
      title={ADMIN_CANNOT_BUY_TITLE}
      {...(className ? { className } : {})}
    >
      {ADMIN_CANNOT_BUY_DESCRIPTION}
    </PolicyNotice>
  );
}

/** Hides bid/buy CTAs for admin accounts; shows {@link AdminCannotBuyNotice} instead. */
export function BuyerGate({
  user,
  children,
  fallback,
}: {
  user: SessionUser | null;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (isAdminBuyerBlocked(user)) {
    return <>{fallback ?? <AdminCannotBuyNotice />}</>;
  }
  return <>{children}</>;
}
