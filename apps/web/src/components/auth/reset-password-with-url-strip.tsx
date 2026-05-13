"use client";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Removes `?token=` from the address bar after read (history + referrer hygiene). */
export function ResetPasswordWithUrlStrip({ token }: { token: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      const next = `${url.pathname}${url.search}`;
      window.history.replaceState({}, "", next || pathname || "/reset-password");
    }
  }, [token, pathname]);

  return <ResetPasswordForm token={token} />;
}
