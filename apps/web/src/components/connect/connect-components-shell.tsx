"use client";

import { useStripeConnectInstance } from "@/components/connect/use-stripe-connect-instance";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import type { ReactNode } from "react";

type Props = {
  publishableKey: string;
  fetchClientSecret: () => Promise<string>;
  children: ReactNode;
};

export function ConnectComponentsShell({ publishableKey, fetchClientSecret, children }: Props) {
  const { connectInstance, error } = useStripeConnectInstance({
    publishableKey,
    fetchClientSecret,
  });

  if (error) {
    return (
      <p className="font-body text-sm text-error" role="alert">
        {error}
      </p>
    );
  }

  if (!connectInstance) {
    return (
      <div className="animate-pulse space-y-3 rounded-lg border border-outline-variant/30 p-6">
        <div className="h-4 w-1/3 rounded bg-surface-container-high" />
        <div className="h-32 rounded bg-surface-container-high" />
      </div>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      {children}
    </ConnectComponentsProvider>
  );
}
