import { PolicyNotice } from "@/components/marketing/policy-notice";
import type { SessionUser } from "@/lib/data/contracts";
import { ADMIN_CANNOT_BUY_DESCRIPTION, ADMIN_CANNOT_BUY_TITLE } from "@/lib/ui/admin-cannot-buy";
import { type UserRole, roleHasCapability } from "@auction/types";
import type { ReactNode } from "react";

export function isAdminBuyerBlocked(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return !roleHasCapability(user.role as UserRole, "bid.place", user.staffRole ?? null);
}

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
