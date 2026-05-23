"use client";

import {
  confirmGuardedNavigation,
  registerDirtyConfirmOpener,
  registerDirtyGuard,
} from "@/components/admin/dirty-navigation-registry";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  isDirty: boolean;
  message?: string;
};

/** Warn before leaving the page when a form has unsaved changes. */
export function FormDirtyGuard({
  isDirty,
  message = "You have unsaved changes. Leave this page?",
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(message);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const openConfirmDialog = useCallback((prompt: string) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDialogMessage(prompt);
      setDialogOpen(true);
    });
  }, []);

  const settleDialog = useCallback((confirmed: boolean) => {
    setDialogOpen(false);
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    return registerDirtyGuard({ message });
  }, [isDirty, message]);

  useEffect(() => {
    if (!isDirty) {
      registerDirtyConfirmOpener(null);
      return;
    }
    registerDirtyConfirmOpener(openConfirmDialog);
    return () => registerDirtyConfirmOpener(null);
  }, [isDirty, openConfirmDialog]);

  useEffect(() => {
    if (!isDirty) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
      } catch {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      void (async () => {
        if (!(await confirmGuardedNavigation())) return;
        const url = new URL(href, window.location.href);
        router.push(`${url.pathname}${url.search}${url.hash}`);
      })();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty, router]);

  return (
    <ConfirmDialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) settleDialog(false);
      }}
      title="Leave without saving?"
      body={dialogMessage}
      confirmLabel="Leave"
      cancelLabel="Stay"
      tone="warning"
      onConfirm={() => settleDialog(true)}
    />
  );
}
