"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type LogoutButtonProps = {
  /** e.g. close mobile drawer before navigating */
  onBeforeNavigate?: () => void;
  className?: string;
};

export function LogoutButton({
  onBeforeNavigate,
  className = "block w-full text-left font-label text-xs uppercase tracking-widest text-secondary transition-colors hover:text-on-surface hover:underline disabled:cursor-not-allowed disabled:opacity-50",
}: LogoutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onLogout = useCallback(async () => {
    onBeforeNavigate?.();
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      setPending(false);
    }
    router.push("/");
    router.refresh();
  }, [onBeforeNavigate, router]);

  return (
    <button type="button" disabled={pending} onClick={onLogout} className={className}>
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
