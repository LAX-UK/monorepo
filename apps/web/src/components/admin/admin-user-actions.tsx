"use client";

import {
  adminSetUserRoleResultAction,
  adminSuspendUserResultAction,
  adminUnsuspendUserResultAction,
} from "@/lib/actions/admin";
import type { UserRole } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const roleOptions: UserRole[] = ["user", "admin"];

type RoleLayout = "row" | "block";

type UserRoleActionProps = {
  userId: string;
  defaultRole: UserRole;
  layout?: RoleLayout;
};

export function UserRoleAction({ userId, defaultRole, layout = "row" }: UserRoleActionProps) {
  const [role, setRole] = useState<UserRole>(defaultRole);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const runSave = () => {
    startTransition(() => {
      void (async () => {
        const r = await adminSetUserRoleResultAction(userId, { role });
        if (r.ok) {
          toast.success("Role updated");
          router.refresh();
          return;
        }
        toast.error(r.error);
      })();
    });
  };

  if (layout === "block") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <select
          className="min-h-11 w-full rounded border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm sm:flex-1"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          disabled={pending}
          aria-label="User role"
        >
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={pending}
          className="min-h-11 w-full sm:w-auto"
          onClick={runSave}
        >
          Save role
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="min-h-11 rounded border border-outline-variant/20 bg-surface-container-lowest px-2 py-1 text-xs"
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        disabled={pending}
        aria-label="User role"
      >
        {roleOptions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="link"
        disabled={pending}
        className="h-auto min-h-11 px-0 py-0 font-label text-[10px] uppercase tracking-widest text-primary underline-offset-2 hover:underline disabled:opacity-50"
        onClick={runSave}
      >
        Save
      </Button>
    </div>
  );
}

type UserSuspendActionProps = {
  userId: string;
  suspendedAt: string | null;
  fullWidthButton?: boolean;
};

export function UserSuspendAction({
  userId,
  suspendedAt,
  fullWidthButton,
}: UserSuspendActionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (suspendedAt) {
    return (
      <Button
        type="button"
        variant="secondary"
        className={fullWidthButton ? "min-h-11 w-full" : "min-h-11"}
        disabled={pending}
        onClick={() => {
          startTransition(() => {
            void (async () => {
              const r = await adminUnsuspendUserResultAction(userId);
              if (r.ok) {
                toast.success("Unsuspended");
                router.refresh();
                return;
              }
              toast.error(r.error);
            })();
          });
        }}
      >
        {fullWidthButton ? "Unsuspend account" : "Unsuspend"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className={fullWidthButton ? "min-h-11 w-full text-error" : "min-h-11 text-error"}
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void (async () => {
            const r = await adminSuspendUserResultAction(userId, { reason: "Admin action" });
            if (r.ok) {
              toast.success("Suspended");
              router.refresh();
              return;
            }
            toast.error(r.error);
          })();
        });
      }}
    >
      {fullWidthButton ? "Suspend account" : "Suspend"}
    </Button>
  );
}
