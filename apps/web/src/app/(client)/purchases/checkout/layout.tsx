import type { ReactNode } from "react";

/** Checkout pages; each shows the readiness strip itself, only to the person who pays. */
export default function CheckoutDashboardLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
