"use client";

import { getQueryClient } from "@/lib/query/get-query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function AppQueryProvider({ children }: Props) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        // Development only. The button sits above the phone tab bar, never over its first tab.
        <div className="fixed bottom-[calc(var(--bottom-nav-height,64px)+1rem)] left-4 z-[var(--z-floating,70)] lg:bottom-4">
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="relative" />
        </div>
      ) : null}
    </QueryClientProvider>
  );
}
