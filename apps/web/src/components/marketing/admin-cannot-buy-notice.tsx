import type { SessionUser } from "@/lib/data/contracts";
import {
  ADMIN_CANNOT_BUY_DESCRIPTION,
  ADMIN_CANNOT_BUY_TITLE,
} from "@/lib/ui/admin-cannot-buy";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { ReactNode } from "react";

export function isAdminBuyerBlocked(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function AdminCannotBuyNotice({ className }: { className?: string }) {
  return (
    <Alert
      className={`border-primary/30 bg-primary-container/10 text-on-surface ring-1 ring-primary/15 ${className ?? ""}`}
    >
      <AlertTitle className="text-on-surface">{ADMIN_CANNOT_BUY_TITLE}</AlertTitle>
      <AlertDescription className="text-on-surface-variant">
        {ADMIN_CANNOT_BUY_DESCRIPTION}
      </AlertDescription>
    </Alert>
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
