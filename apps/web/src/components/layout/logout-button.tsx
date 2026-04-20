"use client";

import { useLogout } from "@/lib/auth/use-logout";

type LogoutButtonProps = {
  /** e.g. close mobile drawer before navigating */
  onBeforeNavigate?: () => void;
  className?: string;
};

export function LogoutButton({
  onBeforeNavigate,
  className = "block w-full text-left font-label text-xs uppercase tracking-widest text-secondary transition-colors hover:text-on-surface hover:underline disabled:cursor-not-allowed disabled:opacity-50",
}: LogoutButtonProps) {
  const { logout, pending } = useLogout(
    onBeforeNavigate !== undefined ? { onBeforeNavigate } : undefined,
  );

  return (
    <button type="button" disabled={pending} onClick={() => void logout()} className={className}>
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
