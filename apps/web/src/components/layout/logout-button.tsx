"use client";

import { useLogout } from "@/lib/auth/use-logout";
import { Button } from "@auction/ui/components/button";
import type { ButtonHTMLAttributes } from "react";

type LogoutButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onClick" | "children"
> & {
  /** e.g. close mobile drawer before navigating */
  onBeforeNavigate?: () => void;
};

const defaultClassName =
  "block w-full text-left font-label text-xs uppercase tracking-widest text-secondary transition-colors hover:text-on-surface hover:underline disabled:cursor-not-allowed disabled:opacity-50";

export function LogoutButton({
  onBeforeNavigate,
  className = defaultClassName,
  ...rest
}: LogoutButtonProps) {
  const { logout, pending } = useLogout(
    onBeforeNavigate !== undefined ? { onBeforeNavigate } : undefined,
  );

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => void logout()}
      className={className}
      {...rest}
    >
      {pending ? "Signing out…" : "Log out"}
    </Button>
  );
}
