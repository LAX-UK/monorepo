"use client";

import { ConnectAccountManagement } from "@stripe/react-connect-js";

export function ConnectManagementPanel() {
  return (
    <div data-testid="connect-management-panel" className="min-h-[320px]">
      <ConnectAccountManagement />
    </div>
  );
}
